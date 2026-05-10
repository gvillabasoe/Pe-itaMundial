"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronLeft, ChevronUp, Check, Save, Sparkles, Trophy, Users, X } from "lucide-react";
import { Flag, GroupBadge, SectionTitle } from "@/components/ui";
import { ADMIN_SPECIAL_FIELDS, ALL_TEAMS_SORTED } from "@/lib/admin-results";
import { GROUPS, type Team } from "@/lib/data";
import {
  BEST_THIRD_MATCH_IDS,
  ROUND32_MATCH_DEFS,
  buildStoredTeamFromDraft,
  createEmptyPorraDraft,
  getEligibleBestThirdTeams,
  getFinalParticipants,
  getGroupFixtures,
  getGroupTeamAtPosition,
  getQuarterMatches,
  getRound16Matches,
  getRound32Matches,
  getSemiMatches,
  validatePorraDraft,
  type PorraDraft,
} from "@/lib/porra-builder";
import { WORLD_CUP_MATCHES } from "@/lib/worldcup/schedule";
import { notifyUserTeamsUpdated } from "@/lib/use-scored-participants";

// (GROUP_SLOT_LABELS eliminado: el nuevo patrón de pills + slots numerados no lo usa)

type BuilderUser = {
  id: string;
  username: string;
};

// ════════════════════════════════════════════════════════════
// createDraftFromTeam — convierte una Team guardada en PorraDraft
// para el modo de edición. La conversión del bracket es aproximada
// (asigna equipos a slots en orden).
// ════════════════════════════════════════════════════════════
function createDraftFromTeam(team: Team): PorraDraft {
  const base = createEmptyPorraDraft(team.userId, team.username);
  base.id = team.id;
  base.teamName = team.name || "";

  // Marcadores
  Object.entries(team.matchPicks || {}).forEach(([fId, pick]) => {
    base.matchPicks[fId] = {
      home: typeof pick.home === "number" ? pick.home : "",
      away: typeof pick.away === "number" ? pick.away : "",
    };
  });

  // Partido doble — Team.doubleMatches es Record<string, string>
  Object.entries(team.doubleMatches || {}).forEach(([group, val]) => {
    if (val) base.doubleMatches[group] = [val];
  });

  // Posiciones de grupo
  Object.entries(team.groupOrderPicks || {}).forEach(([group, picks]) => {
    base.groupOrderPicks[group] = Array.isArray(picks) ? [...picks] : [];
  });

  // Mejores terceros
  base.bestThirdGroups = Array.isArray(team.bestThirdGroups) ? [...team.bestThirdGroups] : [];
  base.bestThirdAssignments = { ...(team.bestThirdAssignments || {}) };

  // Podio
  base.championPick = team.championPick || "";
  base.runnerUpPick = team.runnerUpPick || "";
  base.thirdPlacePick = team.thirdPlacePick || "";

  // Especiales
  base.specials = {
    mejorJugador: team.specials?.mejorJugador || "",
    mejorJoven: team.specials?.mejorJoven || "",
    mejorPortero: team.specials?.mejorPortero || "",
    maxGoleador: team.specials?.maxGoleador || "",
    maxAsistente: team.specials?.maxAsistente || "",
    maxGoleadorEsp: team.specials?.maxGoleadorEsp || "",
    primerGolEsp: team.specials?.primerGolEsp || "",
    revelacion: team.specials?.revelacion || "",
    decepcion: team.specials?.decepcion || "",
    minutoPrimerGol:
      typeof team.specials?.minutoPrimerGol === "number"
        ? String(team.specials.minutoPrimerGol)
        : "",
  };

  // Bracket de eliminatorias — asignación en orden
  const round32Teams = (team.knockoutPicks?.["dieciseisavos"] || []).map((p) => p.country);
  ROUND32_MATCH_DEFS.forEach((matchDef, idx) => {
    const country = round32Teams[idx] || "";
    if (country) base.roundWinners.round32[matchDef.matchId] = country;
  });

  const round16Ids = WORLD_CUP_MATCHES.filter((m) => m.stage === "round-of-16")
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => String(m.id));
  const round16Teams = (team.knockoutPicks?.["octavos"] || []).map((p) => p.country);
  round16Ids.forEach((id, idx) => {
    const country = round16Teams[idx] || "";
    if (country) base.roundWinners.round16[id] = country;
  });

  const quarterIds = WORLD_CUP_MATCHES.filter((m) => m.stage === "quarter-final")
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => String(m.id));
  const quarterTeams = (team.knockoutPicks?.["cuartos"] || []).map((p) => p.country);
  quarterIds.forEach((id, idx) => {
    const country = quarterTeams[idx] || "";
    if (country) base.roundWinners.quarter[id] = country;
  });

  const semiIds = WORLD_CUP_MATCHES.filter((m) => m.stage === "semi-final")
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => String(m.id));
  const semiTeams = (team.knockoutPicks?.["semis"] || []).map((p) => p.country);
  semiIds.forEach((id, idx) => {
    const country = semiTeams[idx] || "";
    if (country) base.roundWinners.semi[id] = country;
  });

  return base;
}

// ════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════

export function MiPorraBuilder({
  user,
  onSaved,
  onCancel,
  initialTeam,
}: {
  user: BuilderUser;
  onSaved: (teamId: string) => void;
  onCancel?: () => void;
  /** Porra existente a editar. Si se pasa, el builder la pre-rellena. */
  initialTeam?: Team;
}) {
  const [draft, setDraft] = useState<PorraDraft>(() =>
    initialTeam
      ? createDraftFromTeam(initialTeam)
      : createEmptyPorraDraft(user.id, user.username)
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const errors = useMemo(() => validatePorraDraft(draft), [draft]);
  const round32Matches = useMemo(() => getRound32Matches(draft), [draft]);
  const round16Matches = useMemo(() => getRound16Matches(draft), [draft]);
  const quarterMatches = useMemo(() => getQuarterMatches(draft), [draft]);
  const semiMatches = useMemo(() => getSemiMatches(draft), [draft]);
  const finalParticipants = useMemo(() => getFinalParticipants(draft), [draft]);

  const setField = <K extends keyof PorraDraft>(field: K, value: PorraDraft[K]) => {
    setSaveError("");
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const updateMatchScore = (fixtureId: string, side: "home" | "away", value: string) => {
    const nextValue = value === "" ? "" : Math.max(0, Math.floor(Number(value)));
    setSaveError("");
    setDraft((current) => ({
      ...current,
      matchPicks: {
        ...current.matchPicks,
        [fixtureId]: {
          ...current.matchPicks[fixtureId],
          [side]: nextValue,
        },
      },
    }));
  };

  const toggleDoubleMatch = (group: string, fixtureId: string, checked: boolean) => {
    setSaveError("");
    setDraft((current) => {
      const selected = new Set(current.doubleMatches[group] || []);
      if (checked) {
        selected.add(fixtureId);
      } else {
        selected.delete(fixtureId);
      }
      return {
        ...current,
        doubleMatches: {
          ...current.doubleMatches,
          [group]: Array.from(selected),
        },
      };
    });
  };

  // ── Tap en una pill: asigna el equipo al SIGUIENTE slot vacío ──
  // Si el equipo ya está colocado, lo quita (toggle).
  const assignNextEmptySlot = (group: string, country: string) => {
    setSaveError("");
    setDraft((current) => {
      const nextGroup = [...(current.groupOrderPicks[group] || ["", "", "", ""])];
      const existingIndex = nextGroup.findIndex((t) => t === country);
      if (existingIndex >= 0) {
        // Toggle: si ya está, lo quitamos
        nextGroup[existingIndex] = "";
      } else {
        // Buscar primer slot vacío
        const emptyIdx = nextGroup.findIndex((t) => !t);
        if (emptyIdx >= 0) nextGroup[emptyIdx] = country;
      }
      return {
        ...current,
        groupOrderPicks: { ...current.groupOrderPicks, [group]: nextGroup },
      };
    });
  };

  // ── X en un slot: quita el equipo de ese slot ──
  const clearGroupSlot = (group: string, positionIndex: number) => {
    setSaveError("");
    setDraft((current) => {
      const nextGroup = [...(current.groupOrderPicks[group] || ["", "", "", ""])];
      nextGroup[positionIndex] = "";
      return {
        ...current,
        groupOrderPicks: { ...current.groupOrderPicks, [group]: nextGroup },
      };
    });
  };

  // ── Flechas ↑↓: intercambia con el slot adyacente ──
  const swapGroupPositions = (group: string, fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex > 3) return;
    setSaveError("");
    setDraft((current) => {
      const nextGroup = [...(current.groupOrderPicks[group] || ["", "", "", ""])];
      const tmp = nextGroup[fromIndex];
      nextGroup[fromIndex] = nextGroup[toIndex];
      nextGroup[toIndex] = tmp;
      return {
        ...current,
        groupOrderPicks: { ...current.groupOrderPicks, [group]: nextGroup },
      };
    });
  };

  const toggleBestThirdGroup = (group: string) => {
    setSaveError("");
    setDraft((current) => {
      const selected = current.bestThirdGroups.includes(group)
        ? current.bestThirdGroups.filter((item) => item !== group)
        : [...current.bestThirdGroups, group];
      return { ...current, bestThirdGroups: selected };
    });
  };

  const updateBestThirdAssignment = (matchId: string, value: string) => {
    setSaveError("");
    setDraft((current) => ({
      ...current,
      bestThirdAssignments: { ...current.bestThirdAssignments, [matchId]: value },
    }));
  };

  const updateWinner = (
    round: "round32" | "round16" | "quarter" | "semi",
    matchId: string,
    value: string
  ) => {
    setSaveError("");
    setDraft((current) => ({
      ...current,
      roundWinners: {
        ...current.roundWinners,
        [round]: { ...current.roundWinners[round], [matchId]: value },
      },
    }));
  };

  const updatePodium = (
    field: "championPick" | "runnerUpPick" | "thirdPlacePick",
    value: string
  ) => {
    setSaveError("");
    setDraft((current) => {
      const next = { ...current, [field]: value };
      (["championPick", "runnerUpPick", "thirdPlacePick"] as const).forEach((key) => {
        if (key !== field && value && next[key] === value) next[key] = "";
      });
      return next;
    });
  };

  const updateSpecial = (field: keyof PorraDraft["specials"], value: string) => {
    setSaveError("");
    setDraft((current) => ({
      ...current,
      specials: { ...current.specials, [field]: value },
    }));
  };

  // ── handleSave: permite guardar aunque la porra esté incompleta ──
  // Los errores de validación se muestran como advertencia, no bloquean.
  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const entry = buildStoredTeamFromDraft(draft);
      const response = await fetch("/api/user-teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "No se ha podido guardar la porra.");
      }
      notifyUserTeamsUpdated();
      onSaved(entry.id);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se ha podido guardar la porra.");
    } finally {
      setSaving(false);
    }
  };

  const isEditing = Boolean(initialTeam);

  return (
    <div className="mx-auto max-w-[920px] px-4 pt-4 pb-36">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-3 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-text-warm">
            {isEditing ? "Editar porra" : "Crear porra"}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {isEditing
              ? "Modifica tu porra. Los cambios se guardan al pulsar el botón."
              : "Completa todas las secciones y guarda tu porra."}
          </p>
        </div>
        {onCancel ? (
          <button type="button" className="btn btn-ghost !px-3.5 !py-2 text-xs" onClick={onCancel}>
            <ChevronLeft size={14} /> Volver
          </button>
        ) : null}
      </div>

      {/* Banner de errores — solo advertencia, no bloquea */}
      {errors.length > 0 ? (
        <div
          className="card mb-5 animate-fade-in"
          style={{ borderColor: "rgba(var(--amber),0.3)", background: "rgba(var(--amber-soft),0.5)" }}
        >
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: "rgba(var(--amber),0.12)", color: "rgb(var(--amber))" }}
            >
              <AlertCircle size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-warm">
                Porra incompleta — puedes guardarla y terminarla antes del 10 de junio
              </p>
              <ul className="mt-2 space-y-0.5 text-xs text-text-muted list-none">
                {saveError ? <li>• {saveError}</li> : null}
                {errors.slice(0, 5).map((e) => <li key={e}>• {e}</li>)}
                {errors.length > 5 ? <li>• Y {errors.length - 5} campos más por completar.</li> : null}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {/* 1. Nombre */}
      <section className="mb-5 animate-fade-in">
        <SectionTitle accent="#D4AF37" icon={Users}>Nombre de la porra</SectionTitle>
        <label className="card admin-field-block">
          <span className="admin-field-label">Nombre del equipo / porra</span>
          <input
            className="input-field"
            placeholder="Escribe el nombre de tu porra"
            value={draft.teamName}
            onChange={(event) => setField("teamName", event.target.value)}
          />
        </label>
      </section>

      {/* 2. Fase de grupos */}
      <section className="mb-5 animate-fade-in" style={{ animationDelay: "0.03s" }}>
        <SectionTitle accent="#55BCBB" icon={Users}>Fase de grupos</SectionTitle>
        <div className="grid gap-3 lg:grid-cols-2">
          {Object.keys(GROUPS).map((group) => {
            const fixtures = getGroupFixtures(group);
            const selectedDoubles = draft.doubleMatches[group] || [];
            return (
              <article key={group} className="card admin-group-card">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <GroupBadge group={group} />
                    <p className="mt-2 text-[11px] text-text-muted">
                      Marca los 6 resultados, el partido doble y el orden final.
                    </p>
                  </div>
                  <span
                    className={`badge ${
                      selectedDoubles.length === 1
                        ? "badge-green"
                        : selectedDoubles.length > 1
                        ? "badge-red"
                        : "badge-muted"
                    }`}
                  >
                    Doble {selectedDoubles.length}/1
                  </span>
                </div>

                <div className="space-y-2.5">
                  {fixtures.map((fixture) => {
                    const pick = draft.matchPicks[fixture.id];
                    const checked = selectedDoubles.includes(fixture.id);
                    return (
                      <div
                        key={fixture.id}
                        className="card admin-match-editor-card !p-3"
                        style={{
                          borderLeft: checked ? "3px solid #DFBE38" : "3px solid transparent",
                        }}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="badge badge-muted text-[10px]">{fixture.round}</span>
                          <label className="inline-flex items-center gap-2 text-[11px] text-text-muted cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) =>
                                toggleDoubleMatch(group, fixture.id, event.target.checked)
                              }
                            />
                            Partido doble
                          </label>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <div className="flex flex-1 items-center justify-end gap-1.5 text-right">
                            <span className="text-xs font-medium text-text-warm">
                              {fixture.homeTeam}
                            </span>
                            <Flag country={fixture.homeTeam} size="sm" />
                          </div>
                          <div className="admin-score-editor">
                            <input
                              className="admin-score-input"
                              inputMode="numeric"
                              type="number"
                              min={0}
                              step={1}
                              placeholder="-"
                              value={pick?.home ?? ""}
                              onChange={(event) =>
                                updateMatchScore(fixture.id, "home", event.target.value)
                              }
                            />
                            <span className="admin-score-separator">-</span>
                            <input
                              className="admin-score-input"
                              inputMode="numeric"
                              type="number"
                              min={0}
                              step={1}
                              placeholder="-"
                              value={pick?.away ?? ""}
                              onChange={(event) =>
                                updateMatchScore(fixture.id, "away", event.target.value)
                              }
                            />
                          </div>
                          <div className="flex flex-1 items-center gap-1.5 text-left">
                            <Flag country={fixture.awayTeam} size="sm" />
                            <span className="text-xs font-medium text-text-warm">
                              {fixture.awayTeam}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ═══ Posiciones del grupo: pills arriba + 4 slots verticales ═══ */}
                <div className="mt-4">
                  <p className="admin-field-label mb-2">Orden final del grupo</p>

                  {/* Pills de equipos: tap para asignar al siguiente slot vacío */}
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {GROUPS[group].map((country) => {
                      const placedAt = (draft.groupOrderPicks[group] || []).indexOf(country);
                      const isPlaced = placedAt >= 0;
                      return (
                        <button
                          key={`${group}-pill-${country}`}
                          type="button"
                          onClick={() => assignNextEmptySlot(group, country)}
                          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all"
                          style={{
                            background: isPlaced ? "rgb(var(--bg-elevated))" : "rgb(var(--bg-3) / 0.92)",
                            border: isPlaced
                              ? "1px solid rgb(var(--border-subtle))"
                              : "1px solid rgb(var(--divider) / 0.16)",
                            color: isPlaced ? "rgb(var(--text-faint))" : "rgb(var(--text-warm))",
                            opacity: isPlaced ? 0.5 : 1,
                          }}
                          title={isPlaced ? `Quitar de ${placedAt + 1}.º` : "Asignar al siguiente puesto"}
                        >
                          <Flag country={country} size="sm" />
                          <span>{country}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* 4 slots numerados verticales */}
                  <div className="rounded-2xl border overflow-hidden"
                    style={{ borderColor: "rgb(var(--divider) / 0.14)", background: "rgb(var(--bg-3) / 0.5)" }}>
                    {[0, 1, 2, 3].map((idx) => {
                      const team = (draft.groupOrderPicks[group] || [])[idx] || "";

                      // Accent por posición:
                      //  0,1 → verde (clasifica)
                      //  2   → ámbar (mejor tercero potencial)
                      //  3   → gris (eliminado)
                      let accent = "rgb(var(--success))";
                      let bg = "rgba(var(--success), 0.06)";
                      if (idx === 2) {
                        accent = "rgb(var(--amber))";
                        bg = "rgba(var(--amber), 0.06)";
                      } else if (idx === 3) {
                        accent = "rgb(var(--text-faint))";
                        bg = "transparent";
                      }

                      // Separador: línea sólida entre 1 y 2; discontinua antes de 3 y 4
                      const topBorderStyle =
                        idx === 0
                          ? "none"
                          : idx === 1
                          ? "1px solid rgb(var(--divider) / 0.10)"
                          : "1px dashed rgb(var(--divider) / 0.20)";

                      return (
                        <div
                          key={`${group}-slot-${idx}`}
                          className="flex items-center gap-3 px-3 py-2.5 relative"
                          style={{ background: team ? bg : "transparent", borderTop: topBorderStyle }}
                        >
                          {/* Accent vertical a la izquierda */}
                          <span
                            aria-hidden
                            className="absolute left-0 top-0 bottom-0 w-[3px]"
                            style={{ background: team ? accent : "transparent" }}
                          />

                          {/* Número */}
                          <span
                            className="font-display text-base font-extrabold tabular-nums w-5 text-center"
                            style={{ color: team ? accent : "rgb(var(--text-faint))" }}
                          >
                            {idx + 1}
                          </span>

                          {/* Equipo o placeholder */}
                          {team ? (
                            <div className="flex-1 flex items-center gap-2 min-w-0">
                              <Flag country={team} size="sm" />
                              <span
                                className="text-sm font-semibold truncate"
                                style={{ color: idx === 3 ? "rgb(var(--text-muted))" : "rgb(var(--text-warm))" }}
                              >
                                {team}
                              </span>
                            </div>
                          ) : (
                            <span className="flex-1 text-[12px] text-text-faint italic">—</span>
                          )}

                          {/* Controles: ↑ ↓ X (sólo si hay equipo) */}
                          {team ? (
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => swapGroupPositions(group, idx, idx - 1)}
                                disabled={idx === 0}
                                className="p-1 rounded-md transition-colors disabled:opacity-30"
                                style={{ color: "rgb(var(--text-muted))", background: "transparent" }}
                                title="Subir"
                                aria-label="Subir posición"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => swapGroupPositions(group, idx, idx + 1)}
                                disabled={idx === 3}
                                className="p-1 rounded-md transition-colors disabled:opacity-30"
                                style={{ color: "rgb(var(--text-muted))", background: "transparent" }}
                                title="Bajar"
                                aria-label="Bajar posición"
                              >
                                <ChevronDown size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => clearGroupSlot(group, idx)}
                                className="p-1 rounded-md transition-colors ml-0.5"
                                style={{ color: "rgb(var(--text-muted))", background: "transparent" }}
                                title="Quitar"
                                aria-label="Quitar equipo"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {/* Leyenda compacta */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-text-faint">
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: "rgb(var(--success))" }} />
                      Clasifican (1.º · 2.º)
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: "rgb(var(--amber))" }} />
                      Mejor 3.º potencial
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: "rgb(var(--text-faint))" }} />
                      Eliminado
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 3. Mejores terceros */}
      <section className="mb-5 animate-fade-in" style={{ animationDelay: "0.06s" }}>
        <SectionTitle accent="#D9B449" icon={Trophy}>Mejores terceros</SectionTitle>
        <div className="card mb-3">
          <p className="text-sm text-text-muted">
            Selecciona qué 8 terceros avanzan y asigna cada uno a su cruce de dieciseisavos.
          </p>
          <p className="mt-1 text-[11px] text-text-muted">
            Seleccionados: {draft.bestThirdGroups.length}/8
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Object.keys(GROUPS).map((group) => {
            const thirdTeam = getGroupTeamAtPosition(draft, group, 3);
            const selected = draft.bestThirdGroups.includes(group);
            return (
              <button
                type="button"
                key={`third-${group}`}
                className={`card text-left transition-all ${selected ? "!border-gold/25 bg-gold/10" : ""}`}
                onClick={() => toggleBestThirdGroup(group)}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <GroupBadge group={group} />
                  <span className={`badge ${selected ? "badge-gold" : "badge-muted"}`}>
                    {selected ? "Avanza" : "No"}
                  </span>
                </div>
                <p className="text-sm font-semibold text-text-warm">{thirdTeam || "3.º pendiente"}</p>
                <p className="mt-1 text-[11px] text-text-muted">
                  Solo aparecerá en los cruces compatibles si está marcado.
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {round32Matches
            .filter((match) => BEST_THIRD_MATCH_IDS.includes(match.matchId))
            .map((match) => {
              const options = getEligibleBestThirdTeams(match.matchId, draft);
              return (
                <label key={`assign-${match.matchId}`} className="card admin-field-block">
                  <span className="admin-field-label">Partido {match.matchId}</span>
                  <p className="mb-2 text-[11px] text-text-muted">
                    {match.homeTeam || match.homeLabel} vs mejor tercero de{" "}
                    {match.awayLabel.replace("3", "")}
                  </p>
                  <select
                    className="input-field admin-select"
                    value={draft.bestThirdAssignments[match.matchId] || ""}
                    onChange={(event) =>
                      updateBestThirdAssignment(match.matchId, event.target.value)
                    }
                  >
                    <option value="">Seleccionar mejor tercero</option>
                    {options.map((team) => (
                      <option key={`${match.matchId}-${team}`} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
        </div>
      </section>

      {/* 4. Fase eliminatoria */}
      <section className="mb-5 animate-fade-in" style={{ animationDelay: "0.09s" }}>
        <SectionTitle accent="#6BBF78" icon={Trophy}>Fase eliminatoria</SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          {round32Matches.map((match) => (
            <KnockoutWinnerCard
              key={`r32-${match.matchId}`}
              title={`Dieciseisavos · ${match.matchId}`}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              homeLabel={match.homeLabel}
              awayLabel={match.awayLabel}
              winner={match.winner}
              onWinnerChange={(value) => updateWinner("round32", match.matchId, value)}
            />
          ))}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {round16Matches.map((match) => (
            <KnockoutWinnerCard
              key={`r16-${match.matchId}`}
              title={`Octavos · ${match.matchId}`}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              homeLabel={match.homeLabel}
              awayLabel={match.awayLabel}
              winner={match.winner}
              onWinnerChange={(value) => updateWinner("round16", match.matchId, value)}
            />
          ))}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {quarterMatches.map((match) => (
            <KnockoutWinnerCard
              key={`qf-${match.matchId}`}
              title={`Cuartos · ${match.matchId}`}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              homeLabel={match.homeLabel}
              awayLabel={match.awayLabel}
              winner={match.winner}
              onWinnerChange={(value) => updateWinner("quarter", match.matchId, value)}
            />
          ))}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {semiMatches.map((match) => (
            <KnockoutWinnerCard
              key={`sf-${match.matchId}`}
              title={`Semifinales · ${match.matchId}`}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              homeLabel={match.homeLabel}
              awayLabel={match.awayLabel}
              winner={match.winner}
              onWinnerChange={(value) => updateWinner("semi", match.matchId, value)}
            />
          ))}
        </div>

        <div className="mt-5 card bg-gold/10 !border-gold/20 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-light">
            Final automática
          </p>
          <div className="mt-3 flex items-center justify-center gap-3">
            <TeamLabel team={finalParticipants.homeTeam} fallback={finalParticipants.homeLabel} />
            <span className="font-display text-base font-black text-gold">vs</span>
            <TeamLabel team={finalParticipants.awayTeam} fallback={finalParticipants.awayLabel} />
          </div>
        </div>
      </section>

      {/* 5. Podio */}
      <section className="mb-5 animate-fade-in" style={{ animationDelay: "0.12s" }}>
        <SectionTitle accent="#D4AF37" icon={Trophy}>Podio</SectionTitle>
        <div className="grid gap-3 md:grid-cols-3">
          <SelectCard
            label="Campeón"
            value={draft.championPick}
            options={ALL_TEAMS_SORTED}
            onChange={(value) => updatePodium("championPick", value)}
          />
          <SelectCard
            label="Subcampeón"
            value={draft.runnerUpPick}
            options={ALL_TEAMS_SORTED}
            onChange={(value) => updatePodium("runnerUpPick", value)}
          />
          <SelectCard
            label="Tercer puesto"
            value={draft.thirdPlacePick}
            options={ALL_TEAMS_SORTED}
            onChange={(value) => updatePodium("thirdPlacePick", value)}
          />
        </div>
      </section>

      {/* 6. Especiales */}
      <section className="animate-fade-in" style={{ animationDelay: "0.15s" }}>
        <SectionTitle accent="#F0417A" icon={Sparkles}>Especiales</SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          {ADMIN_SPECIAL_FIELDS.map((field) => {
            const key = field.key as keyof PorraDraft["specials"];
            const value = draft.specials[key];
            return field.kind === "team" ? (
              <SelectCard
                key={field.key}
                label={field.label}
                value={String(value ?? "")}
                options={ALL_TEAMS_SORTED}
                onChange={(nextValue) => updateSpecial(key, nextValue)}
              />
            ) : (
              <label key={field.key} className="card admin-field-block">
                <span className="admin-field-label">{field.label}</span>
                <input
                  className="input-field"
                  inputMode={field.kind === "number" ? "numeric" : "text"}
                  type={field.kind === "number" ? "number" : "text"}
                  min={field.kind === "number" ? 0 : undefined}
                  step={field.kind === "number" ? 1 : undefined}
                  placeholder={field.kind === "number" ? "0" : field.label}
                  value={String(value ?? "")}
                  onChange={(event) => updateSpecial(key, event.target.value)}
                />
              </label>
            );
          })}
        </div>
      </section>

      {/* CTA fijo */}
      <div className="admin-savebar">
        <div className="min-w-0 flex-1">
          <p className="admin-savebar-title">
            {errors.length === 0
              ? isEditing
                ? "Cambios listos para guardar"
                : "Porra completa"
              : `${errors.length} campo${errors.length !== 1 ? "s" : ""} por completar`}
          </p>
          <p className="admin-savebar-text">
            {isEditing
              ? "Edición disponible hasta el 10 jun a las 21:00"
              : "Máximo 3 porras por usuario. Puedes guardar ahora y editar más tarde."}
          </p>
          {saveError ? (
            <p className="mt-1 text-[11px]" style={{ color: "rgb(var(--danger))" }}>
              {saveError}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn-primary admin-savebar-button"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? <Check size={16} /> : <Save size={16} />}
          {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Guardar porra"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// SUBCOMPONENTES
// ════════════════════════════════════════════════════════════

function KnockoutWinnerCard({
  title,
  homeTeam,
  awayTeam,
  homeLabel,
  awayLabel,
  winner,
  onWinnerChange,
}: {
  title: string;
  homeTeam: string;
  awayTeam: string;
  homeLabel: string;
  awayLabel: string;
  winner: string;
  onWinnerChange: (value: string) => void;
}) {
  const teams = [
    { team: homeTeam, label: homeLabel },
    { team: awayTeam, label: awayLabel },
  ];
  const disabled = !homeTeam || !awayTeam;

  return (
    <article className="card admin-round-card">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
        {title}
      </p>
      <div className="space-y-2">
        {teams.map(({ team, label }) => (
          <button
            key={`${title}-${label}`}
            type="button"
            className={`w-full rounded-2xl border px-3 py-2.5 text-left transition-all ${
              winner === team && team
                ? "border-gold/30 bg-gold/10"
                : "border-[rgb(var(--divider)/0.08)] bg-[rgb(var(--bg-3)/0.62)]"
            }`}
            onClick={() => team && onWinnerChange(team)}
            disabled={!team || disabled}
          >
            <div className="flex items-center justify-between gap-3">
              <TeamLabel team={team} fallback={label} />
              {winner === team && team ? (
                <span className="badge badge-gold">Clasifica</span>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    </article>
  );
}

function SelectCard({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="card admin-field-block">
      <span className="admin-field-label">{label}</span>
      <select
        className="input-field admin-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Seleccionar</option>
        {options.map((option) => (
          <option key={`${label}-${option}`} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TeamLabel({ team, fallback }: { team: string; fallback: string }) {
  if (!team) {
    return <span className="text-xs text-text-muted">{fallback}</span>;
  }
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-text-warm">
      <Flag country={team} size="sm" />
      <span>{team}</span>
    </span>
  );
}
