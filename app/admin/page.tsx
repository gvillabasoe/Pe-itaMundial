"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, LayoutGrid, ListFilter, LogOut, MapPin, Save, Shield, Sparkles, Trash2, Trophy, Users } from "lucide-react";
import { CountrySelectionPreview, Flag, GroupBadge, SectionTitle } from "@/components/ui";
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
  type AdminMatchResult,
  type GroupPositionValue,
  type KnockoutRoundKey,
} from "@/lib/admin-results";
import { getCityBgColor, getCityColor } from "@/lib/config/regions";
import { STAGE_LABELS, STAGE_ORDER, WORLD_CUP_MATCHES, type MatchStage, type WorldCupMatch } from "@/lib/worldcup/schedule";
import { notifyAdminResultsUpdated } from "@/lib/use-scored-participants";

const GROUP_SLOT_ORDER: Array<Exclude<GroupPositionValue, 0>> = [1, 2, 3, 4];
const GROUP_SLOT_LABELS: Record<Exclude<GroupPositionValue, 0>, string> = {
  1: "1.º",
  2: "2.º",
  3: "3.º",
  4: "Eliminado",
};

type ResultsViewMode = "group" | "phase";

type GroupStandingRow = {
  team: string;
  played: number;
  win: number;
  draw: number;
  lose: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

const GROUP_MATCHES_BY_GROUP = Object.keys(GROUPS).reduce<Record<string, WorldCupMatch[]>>((acc, group) => {
  acc[group] = WORLD_CUP_MATCHES.filter(
    (match) =>
      match.stage === "group" && GROUPS[group].includes(match.homeTeam) && GROUPS[group].includes(match.awayTeam)
  );
  return acc;
}, {});

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

function countConfiguredMatchResults(data: AdminResults) {
  return Object.values(data.matchResults).filter(
    (value) => typeof value.home === "number" && typeof value.away === "number"
  ).length;
}

function getTeamForGroupPosition(group: string, position: Exclude<GroupPositionValue, 0>, data: AdminResults) {
  return GROUPS[group].find((team) => data.groupPositions[team] === position) || "";
}

function buildStandingRow(team: string): GroupStandingRow {
  return {
    team,
    played: 0,
    win: 0,
    draw: 0,
    lose: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
  };
}

function computeGroupStandings(group: string, data: AdminResults) {
  const rows = GROUPS[group].reduce<Record<string, GroupStandingRow>>((acc, team) => {
    acc[team] = buildStandingRow(team);
    return acc;
  }, {});

  GROUP_MATCHES_BY_GROUP[group].forEach((match) => {
    const result = data.matchResults[String(match.id)];
    if (typeof result?.home !== "number" || typeof result?.away !== "number") return;

    const home = rows[match.homeTeam];
    const away = rows[match.awayTeam];

    home.played += 1;
    away.played += 1;
    home.gf += result.home;
    home.ga += result.away;
    away.gf += result.away;
    away.ga += result.home;

    if (result.home > result.away) {
      home.win += 1;
      away.lose += 1;
      home.points += 3;
    } else if (result.home < result.away) {
      away.win += 1;
      home.lose += 1;
      away.points += 3;
    } else {
      home.draw += 1;
      away.draw += 1;
      home.points += 1;
      away.points += 1;
    }

    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;
  });

  return Object.values(rows).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.team.localeCompare(b.team, "es");
  });
}

function formatMatchStatus(result: AdminMatchResult | undefined) {
  const hasScore = typeof result?.home === "number" && typeof result?.away === "number";
  if (!hasScore) return { label: "Sin resultado", className: "badge badge-muted" };
  return { label: "Resultado confirmado", className: "badge badge-green" };
}

function getFilteredMatches(mode: ResultsViewMode, selectedGroup: string, selectedStage: MatchStage) {
  if (mode === "group") {
    return GROUP_MATCHES_BY_GROUP[selectedGroup] || [];
  }

  return WORLD_CUP_MATCHES.filter((match) => match.stage === selectedStage);
}

export default function AdminPage() {
  const [form, setForm] = useState<AdminResults>(createDefaultAdminResults());
  const [snapshot, setSnapshot] = useState(serializeAdminResults(createDefaultAdminResults()));
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const [resultsMode, setResultsMode] = useState<ResultsViewMode>("group");
  const [selectedGroup, setSelectedGroup] = useState("A");
  const [selectedStage, setSelectedStage] = useState<MatchStage>("group");

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
  const configuredMatchCount = useMemo(() => countConfiguredMatchResults(form), [form]);
  const completedGroups = useMemo(() => Object.keys(GROUPS).filter((group) => isGroupComplete(group, form)).length, [form]);
  const filteredMatches = useMemo(() => getFilteredMatches(resultsMode, selectedGroup, selectedStage), [resultsMode, selectedGroup, selectedStage]);

  const touchForm = () => {
    setSaveState("idle");
    setSaveError("");
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      window.location.replace("/admin/login");
    }
  };

  const handleMatchScoreChange = (matchId: number, side: "home" | "away", value: string) => {
    const parsed = value === "" ? null : Math.max(0, Math.floor(Number(value)));

    touchForm();
    setForm((current) => {
      const currentResult = current.matchResults[String(matchId)] || { home: null, away: null, statusShort: "NS" as const };
      const nextResult = {
        ...currentResult,
        [side]: Number.isFinite(parsed as number) ? parsed : null,
      };
      const hasBoth = typeof nextResult.home === "number" && typeof nextResult.away === "number";

      return {
        ...current,
        matchResults: {
          ...current.matchResults,
          [String(matchId)]: {
            home: nextResult.home,
            away: nextResult.away,
            statusShort: hasBoth ? "FT" : "NS",
          },
        },
      };
    });
  };

  const handleClearMatchResult = (matchId: number) => {
    touchForm();
    setForm((current) => ({
      ...current,
      matchResults: {
        ...current.matchResults,
        [String(matchId)]: { home: null, away: null, statusShort: "NS" },
      },
    }));
  };

  const handleGroupSlotChange = (group: string, position: Exclude<GroupPositionValue, 0>, value: string) => {
    touchForm();
    setForm((current) => {
      const nextPositions = { ...current.groupPositions };

      GROUPS[group].forEach((team) => {
        if (nextPositions[team] === position) {
          nextPositions[team] = 0;
        }
      });

      if (value) {
        nextPositions[value] = position;
      }

      return {
        ...current,
        groupPositions: nextPositions,
      };
    });
  };

  const handleRoundChange = (roundKey: KnockoutRoundKey, index: number, value: string) => {
    touchForm();
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

  const handlePodiumChange = (field: "campeon" | "subcampeon" | "tercero", value: string) => {
    touchForm();
    setForm((current) => {
      const nextPodium = {
        ...current.podium,
        [field]: value,
      };

      (["campeon", "subcampeon", "tercero"] as const).forEach((key) => {
        if (key !== field && value && nextPodium[key] === value) {
          nextPodium[key] = "";
        }
      });

      return {
        ...current,
        podium: nextPodium,
      };
    });
  };

  const handleSpecialChange = (field: keyof AdminResults["specialResults"], value: string) => {
    touchForm();
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
      <div className="mx-auto max-w-[920px] px-4 pt-4 pb-28">
        <div className="animate-pulse space-y-3">
          <div className="card h-[96px]" />
          <div className="card h-[280px]" />
          <div className="card h-[320px]" />
          <div className="card h-[280px]" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-[920px] px-4 pt-4 pb-32">
        <div className="page-header animate-fade-in">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/15 bg-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-light">
              <Shield size={12} />
              Admin
            </div>
            <h1 className="page-header__title mt-3">Panel de control</h1>
            <p className="mt-2 text-sm text-text-muted">
              Gestiona resultados oficiales, posiciones de grupos, eliminatorias y especiales sin tocar la lógica base de la porra.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="badge badge-muted">{formatAdminSavedAt(form.savedAt)}</span>
            <span className={`badge ${dirty ? "badge-amber" : "badge-green"}`}>{dirty ? "Cambios pendientes" : "Sincronizado"}</span>
            <button type="button" className="btn btn-ghost !px-3 !py-2 text-xs" onClick={() => void handleLogout()}>
              <LogOut size={14} />
              Cerrar sesión
            </button>
          </div>
        </div>

        <section className="mb-5 animate-fade-in">
          <SectionTitle
            accent="#D4AF37"
            icon={Trophy}
            right={
              <button type="button" className="btn btn-primary !px-3.5 !py-2 text-xs" onClick={() => void handleSave()} disabled={saving}>
                {saveState === "saved" ? <Check size={14} /> : <Save size={14} />}
                {saving ? "Guardando..." : "Guardar resultados"}
              </button>
            }
          >
            Resultados oficiales
          </SectionTitle>

          <div className="card admin-results-toolbar">
            <div className="admin-results-toolbar-row">
              <div className="admin-results-toggle">
                <button
                  type="button"
                  className={`pill ${resultsMode === "group" ? "active" : ""}`}
                  onClick={() => {
                    setResultsMode("group");
                    setSelectedStage("group");
                  }}
                >
                  <LayoutGrid size={14} />
                  Por grupo
                </button>
                <button
                  type="button"
                  className={`pill ${resultsMode === "phase" ? "active" : ""}`}
                  onClick={() => setResultsMode("phase")}
                >
                  <ListFilter size={14} />
                  Por fase
                </button>
              </div>

              <div className="admin-results-summary">
                <span className="badge badge-muted text-[10px]">{configuredMatchCount}/{WORLD_CUP_MATCHES.length} con marcador</span>
                <span className="badge badge-muted text-[10px]">{filteredMatches.length} visibles</span>
              </div>
            </div>

            <div className="admin-results-filter-row">
              {resultsMode === "group"
                ? Object.keys(GROUPS).map((group) => (
                    <button
                      key={group}
                      type="button"
                      className={`pill ${selectedGroup === group ? "active" : ""}`}
                      onClick={() => setSelectedGroup(group)}
                    >
                      Grupo {group}
                    </button>
                  ))
                : STAGE_ORDER.map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      className={`pill ${selectedStage === stage ? "active" : ""}`}
                      onClick={() => setSelectedStage(stage)}
                    >
                      {STAGE_LABELS[stage]}
                    </button>
                  ))}
            </div>
          </div>

          <div className="mt-3 grid gap-3">
            {filteredMatches.map((match) => (
              <AdminMatchEditorCard
                key={match.id}
                match={match}
                result={form.matchResults[String(match.id)]}
                onScoreChange={handleMatchScoreChange}
                onClear={handleClearMatchResult}
              />
            ))}
          </div>
        </section>

        <section className="mb-5 animate-fade-in" style={{ animationDelay: "0.04s" }}>
          <SectionTitle accent="#55BCBB" icon={Users} right={<span className="badge badge-muted">{completedGroups}/12 completos</span>}>
            Posiciones en grupos
          </SectionTitle>

          <div className="grid gap-3 md:grid-cols-2">
            {Object.keys(GROUPS).map((group) => {
              const standings = computeGroupStandings(group, form);
              const hasScoredMatches = standings.some((row) => row.played > 0);

              return (
                <article key={group} className="card admin-position-card">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <GroupBadge group={group} />
                    <span className={`badge ${isGroupComplete(group, form) ? "badge-green" : "badge-muted"}`}>
                      {isGroupComplete(group, form) ? "Completo" : "Pendiente"}
                    </span>
                  </div>

                  <div className="admin-position-grid">
                    <div className="admin-position-stack">
                      <p className="admin-field-label">Orden manual</p>
                      {GROUP_SLOT_ORDER.map((position) => (
                        <label key={`${group}-${position}`} className="admin-position-row">
                          <span className="admin-position-slot">{GROUP_SLOT_LABELS[position]}</span>
                          <select
                            className="input-field admin-select"
                            value={getTeamForGroupPosition(group, position, form)}
                            onChange={(event) => handleGroupSlotChange(group, position, event.target.value)}
                          >
                            <option value="">Seleccionar equipo</option>
                            {GROUPS[group].map((team) => (
                              <option key={`${group}-${position}-${team}`} value={team}>
                                {team}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>

                    <div className="admin-position-preview card !p-3">
                      <p className="admin-field-label">Vista guardada</p>
                      <div className="mt-2 space-y-2">
                        {GROUP_SLOT_ORDER.map((position) => {
                          const team = getTeamForGroupPosition(group, position, form);
                          return (
                            <div key={`${group}-preview-${position}`} className="admin-preview-row">
                              <span className="admin-preview-rank">{GROUP_SLOT_LABELS[position]}</span>
                              {team ? (
                                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-text-warm">
                                  <Flag country={team} size="sm" />
                                  <span className="truncate">{team}</span>
                                </span>
                              ) : (
                                <span className="text-[12px] text-text-muted">Sin asignar</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-[18px] border border-[rgb(var(--divider)/0.08)] bg-[rgb(var(--bg-3)/0.78)] px-3 py-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="admin-field-label">Clasificación según marcadores</p>
                      <span className="text-[10px] text-text-muted">{hasScoredMatches ? "Vista orientativa" : "Sin partidos cerrados"}</span>
                    </div>

                    {hasScoredMatches ? (
                      <div className="space-y-1.5">
                        {standings.map((row, index) => (
                          <div key={`${group}-standing-${row.team}`} className="admin-standings-row">
                            <span className="admin-standings-rank">{index + 1}</span>
                            <div className="min-w-0 flex flex-1 items-center gap-2">
                              <Flag country={row.team} size="sm" />
                              <span className="truncate text-[12px] font-semibold text-text-warm">{row.team}</span>
                            </div>
                            <div className="admin-standings-metrics">
                              <span>PJ {row.played}</span>
                              <span>DG {row.gd}</span>
                              <span className="admin-standings-points">{row.points} pts</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] leading-5 text-text-muted">
                        Introduce resultados en este grupo para ver una tabla clara de apoyo antes de fijar las posiciones.
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mb-5 animate-fade-in" style={{ animationDelay: "0.08s" }}>
          <SectionTitle accent="#D4AF37" icon={Sparkles}>Eliminatorias</SectionTitle>
          <div className="grid gap-3">
            {(Object.keys(KNOCKOUT_COUNTS) as KnockoutRoundKey[]).map((roundKey) => (
              <article key={roundKey} className="card admin-round-card">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-[18px] font-black text-text-warm">{KNOCKOUT_LABELS[roundKey]}</h3>
                    <p className="mt-1 text-[11px] text-text-muted">
                      {getRoundUniqueCount(roundKey, form)}/{KNOCKOUT_COUNTS[roundKey]} seleccionados
                    </p>
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
                      <CountrySelectionPreview country={team} emptyLabel="Sin selección" />
                    </label>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-5 animate-fade-in" style={{ animationDelay: "0.12s" }}>
          <SectionTitle accent="#D9B449" icon={Trophy}>Final</SectionTitle>
          <div className="grid gap-3 md:grid-cols-3">
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
              <CountrySelectionPreview country={form.podium.campeon} emptyLabel="Sin selección" />
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
              <CountrySelectionPreview country={form.podium.subcampeon} emptyLabel="Sin selección" />
            </label>

            <label className="card admin-field-block">
              <span className="admin-field-label">Tercer puesto</span>
              <select className="input-field admin-select" value={form.podium.tercero} onChange={(event) => handlePodiumChange("tercero", event.target.value)}>
                <option value="">Seleccionar</option>
                {ALL_TEAMS_SORTED.map((team) => (
                  <option key={`tercero-${team}`} value={team}>
                    {team}
                  </option>
                ))}
              </select>
              <CountrySelectionPreview country={form.podium.tercero} emptyLabel="Sin selección" />
            </label>
          </div>
        </section>

        <section className="animate-fade-in" style={{ animationDelay: "0.16s" }}>
          <SectionTitle accent="#F0417A" icon={Sparkles}>Especiales</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {ADMIN_SPECIAL_FIELDS.map((field) => {
              const key = field.key as keyof AdminResults["specialResults"];
              const value = form.specialResults[key];

              return (
                <label key={field.key} className="card admin-field-block">
                  <span className="admin-field-label">{field.label}</span>
                  {field.kind === "team" ? (
                    <>
                      <select
                        className="input-field admin-select"
                        value={String(value ?? "")}
                        onChange={(event) => handleSpecialChange(key, event.target.value)}
                      >
                        <option value="">Seleccionar</option>
                        {ALL_TEAMS_SORTED.map((team) => (
                          <option key={`${field.key}-${team}`} value={team}>
                            {team}
                          </option>
                        ))}
                      </select>
                      <CountrySelectionPreview country={String(value ?? "")} emptyLabel="Sin selección" />
                    </>
                  ) : field.kind === "number" ? (
                    <input
                      className="input-field"
                      inputMode="numeric"
                      type="number"
                      min={0}
                      step={1}
                      placeholder="0"
                      value={typeof value === "number" ? value : ""}
                      onChange={(event) => handleSpecialChange(key, event.target.value)}
                    />
                  ) : (
                    <input
                      className="input-field"
                      placeholder={field.label}
                      value={String(value ?? "")}
                      onChange={(event) => handleSpecialChange(key, event.target.value)}
                    />
                  )}
                </label>
              );
            })}
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

function AdminMatchEditorCard({
  match,
  result,
  onScoreChange,
  onClear,
}: {
  match: WorldCupMatch;
  result: AdminMatchResult | undefined;
  onScoreChange: (matchId: number, side: "home" | "away", value: string) => void;
  onClear: (matchId: number) => void;
}) {
  const group = match.stage === "group"
    ? Object.keys(GROUPS).find((key) => GROUPS[key].includes(match.homeTeam) && GROUPS[key].includes(match.awayTeam)) || null
    : null;
  const cityColor = getCityColor(match.hostCity);
  const status = formatMatchStatus(result);
  const hasBoth = typeof result?.home === "number" && typeof result?.away === "number";

  return (
    <article className="card admin-match-editor-card">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-mono text-text-muted">#{match.id}</span>
          {group ? <GroupBadge group={group} /> : null}
          <span className={status.className}>{status.label}</span>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold"
          style={{ background: getCityBgColor(match.hostCity), color: cityColor, border: `1px solid ${cityColor}33` }}
        >
          <MapPin size={9} /> {match.hostCity}
        </span>
      </div>

      <div className="flex items-center justify-center gap-2">
        <div className="flex flex-1 items-center justify-end gap-1.5 text-right">
          <span className="text-xs font-medium text-text-warm">{match.homeTeam}</span>
          <Flag country={match.homeTeam} size="sm" />
        </div>

        <div className="admin-score-editor">
          <input
            className="admin-score-input"
            inputMode="numeric"
            type="number"
            min={0}
            step={1}
            placeholder="-"
            value={typeof result?.home === "number" ? result.home : ""}
            onChange={(event) => onScoreChange(match.id, "home", event.target.value)}
          />
          <span className="admin-score-separator">-</span>
          <input
            className="admin-score-input"
            inputMode="numeric"
            type="number"
            min={0}
            step={1}
            placeholder="-"
            value={typeof result?.away === "number" ? result.away : ""}
            onChange={(event) => onScoreChange(match.id, "away", event.target.value)}
          />
        </div>

        <div className="flex flex-1 items-center gap-1.5 text-left">
          <Flag country={match.awayTeam} size="sm" />
          <span className="text-xs font-medium text-text-warm">{match.awayTeam}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[rgb(var(--divider)/0.06)] pt-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="badge badge-muted text-[10px]">{match.roundLabel}</span>
          <span className="text-[10px] text-text-muted">{hasBoth ? "Marcador listo para guardar" : "Introduce ambos goles para confirmar"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-text-muted">
            <Clock3 size={11} /> Resultado oficial
          </span>
          <button type="button" className="btn btn-ghost !px-3 !py-2 text-[11px]" onClick={() => onClear(match.id)}>
            <Trash2 size={13} />
            Limpiar
          </button>
        </div>
      </div>
    </article>
  );
}
