"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, LogOut, Save, Shield } from "lucide-react";
import { Flag, GroupBadge, SectionTitle } from "@/components/ui";
import { GROUPS } from "@/lib/data";
import {
  ADMIN_SPECIAL_FIELDS,
  ALL_TEAMS_SORTED,
  KNOCKOUT_COUNTS,
  KNOCKOUT_LABELS,
  createDefaultAdminResults,
  formatAdminSavedAt,
  sanitizeAdminResults,
  type AdminResults,
  type GroupPositionValue,
  type KnockoutRoundKey,
} from "@/lib/admin-results";
import { notifyAdminResultsUpdated } from "@/lib/use-scored-participants";

const POSITION_OPTIONS: Array<{ value: GroupPositionValue; label: string }> = [
  { value: 0, label: "—" },
  { value: 1, label: "1º" },
  { value: 2, label: "2º" },
  { value: 3, label: "3º" },
  { value: 4, label: "Eliminado" },
];

function serializeAdminResults(data: AdminResults) {
  return JSON.stringify(sanitizeAdminResults(data));
}

function isGroupComplete(group: string, data: AdminResults) {
  const values = GROUPS[group].map((team) => data.groupPositions[team]).filter((value) => value > 0);
  if (values.length !== 4) return false;
  return new Set(values).size === 4;
}

function getRoundUniqueCount(roundKey: KnockoutRoundKey, data: AdminResults) {
  return new Set(data.knockoutRounds[roundKey].filter(Boolean)).size;
}

function isRoundComplete(roundKey: KnockoutRoundKey, data: AdminResults) {
  return getRoundUniqueCount(roundKey, data) === KNOCKOUT_COUNTS[roundKey];
}

export default function AdminPage() {
  const [form, setForm] = useState<AdminResults>(createDefaultAdminResults());
  const [snapshot, setSnapshot] = useState(serializeAdminResults(createDefaultAdminResults()));
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const response = await fetch("/api/admin-results", { cache: "no-store" });
        const payload = await response.json();
        const sanitized = sanitizeAdminResults(payload);
        if (!mounted) return;
        setForm(sanitized);
        setSnapshot(serializeAdminResults(sanitized));
      } catch {
        if (!mounted) return;
        const fallback = createDefaultAdminResults();
        setForm(fallback);
        setSnapshot(serializeAdminResults(fallback));
      } finally {
        if (mounted) {
          setReady(true);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (saveState !== "saved") return undefined;
    const timeout = window.setTimeout(() => setSaveState("idle"), 2200);
    return () => window.clearTimeout(timeout);
  }, [saveState]);

  const dirty = useMemo(() => serializeAdminResults(form) !== snapshot, [form, snapshot]);

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      window.location.replace("/admin/login");
    }
  };

  const handleGroupPositionChange = (team: string, value: string) => {
    const nextValue = Number(value) as GroupPositionValue;
    setSaveState("idle");
    setSaveError("");
    setForm((current) => ({
      ...current,
      groupPositions: {
        ...current.groupPositions,
        [team]: nextValue,
      },
    }));
  };

  const handleRoundChange = (roundKey: KnockoutRoundKey, index: number, value: string) => {
    setSaveState("idle");
    setSaveError("");
    setForm((current) => {
      const nextRound = [...current.knockoutRounds[roundKey]];

      if (value) {
        nextRound.forEach((team, teamIndex) => {
          if (teamIndex !== index && team === value) {
            nextRound[teamIndex] = "";
          }
        });
      }

      nextRound[index] = value;

      return {
        ...current,
        knockoutRounds: {
          ...current.knockoutRounds,
          [roundKey]: nextRound,
        },
      };
    });
  };

  const handlePodiumChange = (field: "campeon" | "subcampeon", value: string) => {
    setSaveState("idle");
    setSaveError("");
    setForm((current) => {
      const otherField = field === "campeon" ? "subcampeon" : "campeon";
      return {
        ...current,
        podium: {
          ...current.podium,
          [field]: value,
          [otherField]: value && current.podium[otherField] === value ? "" : current.podium[otherField],
        },
      };
    });
  };

  const handleSpecialChange = (field: keyof AdminResults["specialResults"], value: string) => {
    setSaveState("idle");
    setSaveError("");
    setForm((current) => ({
      ...current,
      specialResults: {
        ...current.specialResults,
        [field]: field === "minutoPrimerGol" ? (value === "" ? null : Number(value)) : value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    setSaveState("idle");

    try {
      const response = await fetch("/api/admin-results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "No se han podido guardar los cambios");
      }

      const sanitized = sanitizeAdminResults(payload);
      setForm(sanitized);
      setSnapshot(serializeAdminResults(sanitized));
      setSaveState("saved");
      notifyAdminResultsUpdated();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se han podido guardar los cambios");
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <div className="mx-auto max-w-[760px] px-4 pt-4 pb-28">
        <div className="animate-pulse space-y-3">
          <div className="card h-[96px]" />
          <div className="card h-[240px]" />
          <div className="card h-[240px]" />
          <div className="card h-[240px]" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-[760px] px-4 pt-4 pb-32">
        <div className="page-header animate-fade-in">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/15 bg-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-light">
              <Shield size={12} />
              Admin
            </div>
            <h1 className="page-header__title mt-3">Panel</h1>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="badge badge-muted">{formatAdminSavedAt(form.savedAt)}</span>
            <button type="button" className="btn btn-ghost !px-3 !py-2 text-xs" onClick={() => void handleLogout()}>
              <LogOut size={14} />
              Cerrar sesión
            </button>
          </div>
        </div>

        <section className="mb-5 animate-fade-in">
          <SectionTitle accent="#D4AF37">Fase de grupos</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {Object.keys(GROUPS).map((group) => (
              <article key={group} className="card admin-group-card">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <GroupBadge group={group} />
                  <span className={`badge ${isGroupComplete(group, form) ? "badge-green" : "badge-muted"}`}>
                    {isGroupComplete(group, form) ? "Completo" : "Pendiente"}
                  </span>
                </div>

                <div className="space-y-2">
                  {GROUPS[group].map((team) => (
                    <div key={team} className="admin-team-row">
                      <div className="min-w-0 flex items-center gap-2">
                        <Flag country={team} size="sm" />
                        <span className="truncate text-sm font-semibold text-text-warm">{team}</span>
                      </div>
                      <select
                        className="input-field admin-select"
                        value={form.groupPositions[team]}
                        onChange={(event) => handleGroupPositionChange(team, event.target.value)}
                      >
                        {POSITION_OPTIONS.map((option) => (
                          <option key={option.label} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-5 animate-fade-in" style={{ animationDelay: "0.04s" }}>
          <SectionTitle accent="#55BCBB">Eliminatorias</SectionTitle>
          <div className="grid gap-3">
            {(Object.keys(KNOCKOUT_COUNTS) as KnockoutRoundKey[]).map((roundKey) => (
              <article key={roundKey} className="card admin-round-card">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-[18px] font-black text-text-warm">{KNOCKOUT_LABELS[roundKey]}</h3>
                    <p className="mt-1 text-[11px] text-text-muted">{getRoundUniqueCount(roundKey, form)}/{KNOCKOUT_COUNTS[roundKey]}</p>
                  </div>
                  <span className={`badge ${isRoundComplete(roundKey, form) ? "badge-green" : "badge-muted"}`}>
                    {isRoundComplete(roundKey, form) ? "Completo" : "Pendiente"}
                  </span>
                </div>

                <div className="admin-round-grid">
                  {form.knockoutRounds[roundKey].map((team, index) => (
                    <label key={`${roundKey}-${index}`} className="admin-field-block">
                      <span className="admin-slot-label">Equipo {index + 1}</span>
                      <select
                        className="input-field admin-select"
                        value={team}
                        onChange={(event) => handleRoundChange(roundKey, index, event.target.value)}
                      >
                        <option value="">Seleccionar</option>
                        {ALL_TEAMS_SORTED.map((option) => (
                          <option key={`${roundKey}-${option}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-5 animate-fade-in" style={{ animationDelay: "0.08s" }}>
          <SectionTitle accent="#D4AF37">Final</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="card admin-field-block">
              <span className="admin-field-label">Campeón</span>
              <select className="input-field admin-select" value={form.podium.campeon} onChange={(event) => handlePodiumChange("campeon", event.target.value)}>
                <option value="">Seleccionar</option>
                {ALL_TEAMS_SORTED.map((team) => (
                  <option key={`campeon-${team}`} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </label>

            <label className="card admin-field-block">
              <span className="admin-field-label">Subcampeón</span>
              <select className="input-field admin-select" value={form.podium.subcampeon} onChange={(event) => handlePodiumChange("subcampeon", event.target.value)}>
                <option value="">Seleccionar</option>
                {ALL_TEAMS_SORTED.map((team) => (
                  <option key={`subcampeon-${team}`} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="animate-fade-in" style={{ animationDelay: "0.12s" }}>
          <SectionTitle accent="#F0417A">Especiales</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {ADMIN_SPECIAL_FIELDS.map((field) => (
              <label key={field.key} className="card admin-field-block">
                <span className="admin-field-label">{field.label}</span>
                {field.kind === "team" ? (
                  <select
                    className="input-field admin-select"
                    value={String(form.specialResults[field.key] ?? "")}
                    onChange={(event) => handleSpecialChange(field.key, event.target.value)}
                  >
                    <option value="">Seleccionar</option>
                    {ALL_TEAMS_SORTED.map((team) => (
                      <option key={`${field.key}-${team}`} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                ) : field.kind === "number" ? (
                  <input
                    className="input-field"
                    inputMode="numeric"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="0"
                    value={form.specialResults.minutoPrimerGol ?? ""}
                    onChange={(event) => handleSpecialChange(field.key, event.target.value)}
                  />
                ) : (
                  <input
                    className="input-field"
                    placeholder={field.label}
                    value={String(form.specialResults[field.key] ?? "")}
                    onChange={(event) => handleSpecialChange(field.key, event.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
        </section>
      </div>

      <div className="admin-savebar">
        <div className="min-w-0">
          <p className="admin-savebar-title">
            {saveState === "saved" ? "Cambios guardados" : dirty ? "Cambios sin guardar" : "Sin cambios"}
          </p>
          <p className="admin-savebar-text">{formatAdminSavedAt(form.savedAt)}</p>
          {saveError ? <p className="mt-1 text-[11px] text-danger">{saveError}</p> : null}
        </div>

        <button type="button" className="btn btn-primary admin-savebar-button" onClick={() => void handleSave()} disabled={saving}>
          {saveState === "saved" ? <Check size={16} /> : <Save size={16} />}
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>

      {saveState === "saved" ? (
        <div className="admin-toast">
          <Check size={16} />
          Guardado
        </div>
      ) : null}
    </>
  );
}
