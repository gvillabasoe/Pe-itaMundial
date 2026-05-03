"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  CircleCheck,
  Save,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { CountrySelectionPreview, Flag, GroupBadge, SectionTitle } from "@/components/ui";
import { ADMIN_SPECIAL_FIELDS, ALL_TEAMS_SORTED } from "@/lib/admin-results";
import { GROUPS } from "@/lib/data";
import {
  BEST_THIRD_MATCH_IDS,
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

// ════════════════════════════════════════════════════════════
// Refactor visual — la lógica del builder NO se ha tocado.
// Se mejora layout, jerarquía, separadores, posicionamiento
// del CTA, y el resumen de progreso para evitar errores de
// usabilidad detectados en la captura del usuario.
// ════════════════════════════════════════════════════════════

const GROUP_SLOT_LABELS = ["1.º", "2.º", "3.º", "4.º"] as const;

type BuilderUser = {
  id: string;
  username: string;
};

/**
 * Calcula el progreso del draft en 6 etapas. Sirve para alimentar el
 * stepper y el contador del CTA flotante. No mueve la lógica de
 * validación, solo deriva métricas para feedback visual.
 */
function calculateProgress(draft: PorraDraft) {
  const groups = Object.keys(GROUPS);
  const totalMatches = groups.length * 6; // 12 grupos × 6 partidos
  const filledMatches = Object.values(draft.matchPicks).filter(
    (p) => p && p.home !== "" && p.away !== ""
  ).length;
  const groupsWithDouble = groups.filter(
    (g) => (draft.doubleMatches[g] || []).length === 1
  ).length;
  const groupsWithOrder = groups.filter((g) => {
    const order = draft.groupOrderPicks[g] || [];
    return order.length === 4 && order.every(Boolean);
  }).length;
  const totalKnockoutWinners =
    Object.values(draft.roundWinners.round32 || {}).filter(Boolean).length +
    Object.values(draft.roundWinners.round16 || {}).filter(Boolean).length +
    Object.values(draft.roundWinners.quarter || {}).filter(Boolean).length +
    Object.values(draft.roundWinners.semi || {}).filter(Boolean).length;
  const podiumComplete = Boolean(
    draft.championPick && draft.runnerUpPick && draft.thirdPlacePick
  );
  const specialFields = ADMIN_SPECIAL_FIELDS.length;
  const filledSpecials = ADMIN_SPECIAL_FIELDS.filter((f) => {
    const v = draft.specials[f.key as keyof typeof draft.specials];
    return v !== "" && v !== undefined && v !== null;
  }).length;

  const steps = [
    {
      label: "Nombre",
      done: Boolean(draft.teamName.trim()),
      current: !draft.teamName.trim(),
    },
    {
      label: "Grupos",
      done: filledMatches === totalMatches,
      progress: `${filledMatches}/${totalMatches}`,
    },
    {
      label: "Doble",
      done: groupsWithDouble === groups.length,
      progress: `${groupsWithDouble}/${groups.length}`,
    },
    {
      label: "Posiciones",
      done: groupsWithOrder === groups.length,
      progress: `${groupsWithOrder}/${groups.length}`,
    },
    {
      label: "Eliminatorias",
      done: totalKnockoutWinners >= 30, // 16+8+4+2 = 30
      progress: `${totalKnockoutWinners}/30`,
    },
    {
      label: "Podio + Especiales",
      done: podiumComplete && filledSpecials === specialFields,
      progress: `${filledSpecials}/${specialFields}`,
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const percent = Math.round((completed / steps.length) * 100);

  return { steps, completed, total: steps.length, percent };
}

export function MiPorraBuilder({
  user,
  onSaved,
  onCancel,
}: {
  user: BuilderUser;
  onSaved: (teamId: string) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<PorraDraft>(() =>
    createEmptyPorraDraft(user.id, user.username)
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const errors = useMemo(() => validatePorraDraft(draft), [draft]);
  const progress = useMemo(() => calculateProgress(draft), [draft]);
  const round32Matches = useMemo(() => getRound32Matches(draft), [draft]);
  const round16Matches = useMemo(() => getRound16Matches(draft), [draft]);
  const quarterMatches = useMemo(() => getQuarterMatches(draft), [draft]);
  const semiMatches = useMemo(() => getSemiMatches(draft), [draft]);
  const finalParticipants = useMemo(() => getFinalParticipants(draft), [draft]);

  const setField = <K extends keyof PorraDraft>(field: K, value: PorraDraft[K]) => {
    setSaveError("");
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const updateMatchScore = (
    fixtureId: string,
    side: "home" | "away",
    value: string
  ) => {
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
      // Solo se permite UN partido doble por grupo. Si ya hay otro, se reemplaza.
      const next = checked ? [fixtureId] : [];
      return {
        ...current,
        doubleMatches: { ...current.doubleMatches, [group]: next },
      };
    });
  };

  const updateGroupPosition = (group: string, positionIndex: number, value: string) => {
    setSaveError("");
    setDraft((current) => {
      const nextGroup = [...(current.groupOrderPicks[group] || ["", "", "", ""])];
      const previousIndex = nextGroup.findIndex((team) => team === value);
      if (previousIndex >= 0 && previousIndex !== positionIndex) {
        nextGroup[previousIndex] = "";
      }
      nextGroup[positionIndex] = value;
      return {
        ...current,
        groupOrderPicks: {
          ...current.groupOrderPicks,
          [group]: nextGroup,
        },
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
      bestThirdAssignments: {
        ...current.bestThirdAssignments,
        [matchId]: value,
      },
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
        if (key !== field && value && next[key] === value) {
          next[key] = "";
        }
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

  const handleSave = async () => {
    const currentErrors = validatePorraDraft(draft);
    if (currentErrors.length > 0) {
      setShowErrors(true);
      setSaveError(currentErrors[0]);
      // scroll suave hasta el banner de errores
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
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
      await onSaved(entry.id);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "No se ha podido guardar la porra."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[920px] px-4 pt-4 pb-40">
      {/* ── HEADER ── */}
      <div className="page-header animate-fade-in">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/15 bg-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-light">
            <Trophy size={12} />
            Mi Porra
          </div>
          <h1 className="page-header__title mt-3">Rellena tu porra</h1>
          <p className="mt-2 text-sm text-text-muted">
            Completa todos los apartados. Al guardar, tu porra quedará bloqueada en
            modo lectura.
          </p>
        </div>
        {onCancel ? (
          <button
            type="button"
            className="btn btn-ghost !px-3.5 !py-2 text-xs"
            onClick={onCancel}
          >
            <ChevronLeft size={14} />
            Volver
          </button>
        ) : null}
      </div>

      {/* ── PROGRESO + STEPPER ── */}
      <div className="card mb-4 animate-fade-in">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Progreso · {progress.completed}/{progress.total} apartados
          </span>
          <span className="text-[11px] font-bold text-gold tabular-nums">
            {progress.percent}%
          </span>
        </div>
        <div
          className="h-2 rounded-full overflow-hidden mb-3"
          style={{ background: "rgb(var(--bg-muted))" }}
          role="progressbar"
          aria-valuenow={progress.percent}
        >
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progress.percent}%`,
              background: "linear-gradient(90deg, rgb(var(--gold-light)), rgb(var(--gold)))",
            }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {progress.steps.map((step, idx) => (
            <span
              key={idx}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                step.done
                  ? "bg-success/10 text-success"
                  : "bg-bg-2 text-text-muted"
              }`}
            >
              {step.done ? <CircleCheck size={10} /> : <span className="w-2.5" />}
              {step.label}
              {step.progress && !step.done ? (
                <span className="opacity-60">· {step.progress}</span>
              ) : null}
            </span>
          ))}
        </div>
      </div>

      {/* ── ERRORES ── */}
      {(saveError || (showErrors && errors.length > 0)) && (
        <div
          className="card mb-5 animate-fade-in"
          style={{
            borderColor: "rgba(var(--danger), 0.3)",
            background: "rgba(var(--danger-soft), 0.5)",
          }}
        >
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: "rgba(var(--danger), 0.12)",
                color: "rgb(var(--danger))",
                border: "1px solid rgba(var(--danger), 0.2)",
              }}
            >
              <AlertCircle size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-warm">
                Revisa la porra antes de guardar
              </p>
              <ul className="mt-2 space-y-1 text-xs text-text-muted">
                {saveError ? <li>• {saveError}</li> : null}
                {!saveError &&
                  errors.slice(0, 6).map((e) => <li key={e}>• {e}</li>)}
                {errors.length > 6 ? (
                  <li className="opacity-70">
                    • Y {errors.length - 6} cosas más por completar.
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── 1. NOMBRE ── */}
      <section className="mb-5 animate-fade-in">
        <SectionTitle accent="#C99625" icon={Users}>
          1. Nombre de tu porra
        </SectionTitle>
        <div className="card">
          <label className="block">
            <span className="admin-field-label">
              Nombre del equipo
              <span className="required-asterisk">*</span>
            </span>
            <input
              className="input-field mt-1.5"
              placeholder="Ej. Los Cracks 2026"
              maxLength={40}
              value={draft.teamName}
              onChange={(e) => setField("teamName", e.target.value)}
            />
            <p className="mt-1.5 text-[11px] text-text-muted">
              Máximo 40 caracteres. Visible para todos los participantes.
            </p>
          </label>
        </div>
      </section>

      {/* ── 2. FASE DE GRUPOS ── */}
      <section className="mb-5 animate-fade-in">
        <SectionTitle accent="#0E9F6E" icon={Users}>
          2. Fase de grupos
        </SectionTitle>
        <p className="text-[12px] text-text-muted mb-3">
          Por cada grupo: marca los 6 marcadores, elige el partido doble (1 por
          grupo) y ordena la clasificación final del 1.º al 4.º.
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          {Object.keys(GROUPS).map((group) => (
            <GroupCard
              key={group}
              group={group}
              draft={draft}
              onScoreChange={updateMatchScore}
              onDoubleToggle={toggleDoubleMatch}
              onPositionChange={updateGroupPosition}
            />
          ))}
        </div>
      </section>

      {/* ── 3. MEJORES TERCEROS ── */}
      <section className="mb-5 animate-fade-in">
        <SectionTitle accent="#B58A1B" icon={Trophy}>
          3. Mejores terceros
        </SectionTitle>
        <div className="card mb-3">
          <p className="text-sm text-text-muted">
            Selecciona qué 8 terceros avanzan a dieciseisavos.
          </p>
          <p className="mt-1 text-[11px] text-gold font-semibold">
            Seleccionados: {draft.bestThirdGroups.length}/8
          </p>
        </div>
        <div className="grid gap-2 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {Object.keys(GROUPS).map((group) => {
            const thirdTeam = getGroupTeamAtPosition(draft, group, 3);
            const selected = draft.bestThirdGroups.includes(group);
            return (
              <button
                type="button"
                key={`third-${group}`}
                className={`card text-left transition-all !p-3 ${
                  selected ? "!border-gold/40" : ""
                }`}
                style={selected ? { background: "rgb(var(--gold-soft))" } : undefined}
                onClick={() => toggleBestThirdGroup(group)}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <GroupBadge group={group} />
                  <span className={`badge ${selected ? "badge-gold" : "badge-muted"} text-[9px]`}>
                    {selected ? "Avanza" : "—"}
                  </span>
                </div>
                <p className="text-xs font-semibold text-text-warm truncate">
                  {thirdTeam || "3.º pendiente"}
                </p>
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {round32Matches
            .filter((m) => BEST_THIRD_MATCH_IDS.includes(m.matchId))
            .map((match) => {
              const options = getEligibleBestThirdTeams(match.matchId, draft);
              return (
                <label
                  key={`assign-${match.matchId}`}
                  className="card admin-field-block"
                >
                  <span className="admin-field-label">Partido {match.matchId}</span>
                  <p className="mb-2 text-[11px] text-text-muted">
                    {match.homeTeam || match.homeLabel} vs mejor 3.º de{" "}
                    {match.awayLabel.replace("3", "")}
                  </p>
                  <select
                    className="input-field admin-select"
                    value={draft.bestThirdAssignments[match.matchId] || ""}
                    onChange={(e) =>
                      updateBestThirdAssignment(match.matchId, e.target.value)
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

      {/* ── 4. ELIMINATORIAS ── */}
      <section className="mb-5 animate-fade-in">
        <SectionTitle accent="#C99625" icon={Trophy}>
          4. Cuadro eliminatorio
        </SectionTitle>
        <p className="text-[12px] text-text-muted mb-3">
          Marca el ganador de cada cruce. Los rivales se rellenan automáticamente
          según tus decisiones previas.
        </p>

        <KnockoutRoundGrid
          title="Dieciseisavos · 16 partidos"
          matches={round32Matches}
          round="round32"
          onWinnerChange={updateWinner}
        />
        <KnockoutRoundGrid
          title="Octavos · 8 partidos"
          matches={round16Matches}
          round="round16"
          onWinnerChange={updateWinner}
        />
        <KnockoutRoundGrid
          title="Cuartos · 4 partidos"
          matches={quarterMatches}
          round="quarter"
          onWinnerChange={updateWinner}
        />
        <KnockoutRoundGrid
          title="Semifinales · 2 partidos"
          matches={semiMatches}
          round="semi"
          onWinnerChange={updateWinner}
        />

        <div
          className="card mt-4 text-center"
          style={{
            background: "rgb(var(--gold-soft))",
            borderColor: "rgba(var(--gold), 0.2)",
          }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold mb-3">
            Final automática
          </p>
          <div className="flex items-center justify-center gap-3">
            <TeamLabel
              team={finalParticipants.homeTeam}
              fallback={finalParticipants.homeLabel}
            />
            <span className="font-display text-base font-black text-gold">vs</span>
            <TeamLabel
              team={finalParticipants.awayTeam}
              fallback={finalParticipants.awayLabel}
            />
          </div>
        </div>
      </section>

      {/* ── 5. PODIO ── */}
      <section className="mb-5 animate-fade-in">
        <SectionTitle accent="#C99625" icon={Trophy}>
          5. Podio final
        </SectionTitle>
        <div className="grid gap-3 md:grid-cols-3">
          <SelectCard
            label="🥇 Campeón"
            value={draft.championPick}
            options={ALL_TEAMS_SORTED}
            onChange={(v) => updatePodium("championPick", v)}
          />
          <SelectCard
            label="🥈 Subcampeón"
            value={draft.runnerUpPick}
            options={ALL_TEAMS_SORTED}
            onChange={(v) => updatePodium("runnerUpPick", v)}
          />
          <SelectCard
            label="🥉 Tercer puesto"
            value={draft.thirdPlacePick}
            options={ALL_TEAMS_SORTED}
            onChange={(v) => updatePodium("thirdPlacePick", v)}
          />
        </div>
      </section>

      {/* ── 6. ESPECIALES ── */}
      <section className="animate-fade-in">
        <SectionTitle accent="#D6336F" icon={Sparkles}>
          6. Especiales
        </SectionTitle>
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
                onChange={(v) => updateSpecial(key, v)}
              />
            ) : (
              <label key={field.key} className="card admin-field-block">
                <span className="admin-field-label">{field.label}</span>
                <input
                  className="input-field mt-1.5"
                  inputMode={field.kind === "number" ? "numeric" : "text"}
                  type={field.kind === "number" ? "number" : "text"}
                  min={field.kind === "number" ? 0 : undefined}
                  step={field.kind === "number" ? 1 : undefined}
                  placeholder={field.kind === "number" ? "0" : field.label}
                  value={String(value ?? "")}
                  onChange={(e) => updateSpecial(key, e.target.value)}
                />
              </label>
            );
          })}
        </div>
      </section>

      {/* ── CTA FLOTANTE ── */}
      <div className="admin-savebar">
        <div className="min-w-0 flex-1">
          <p className="admin-savebar-title">
            {progress.percent === 100
              ? "✓ Porra completa"
              : `Te falta ${100 - progress.percent}%`}
          </p>
          <p className="admin-savebar-text">
            {errors.length === 0
              ? "Lista para guardar"
              : `${errors.length} cosa${errors.length === 1 ? "" : "s"} por revisar`}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary admin-savebar-button"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? <Check size={16} /> : <Save size={16} />}
          {saving ? "Guardando..." : "Guardar porra"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Subcomponentes
// ════════════════════════════════════════════════════════════

/**
 * Tarjeta visual de un grupo: muestra los 6 partidos divididos en 3 jornadas
 * (J1, J2, J3) según el orden ya guardado en `getGroupFixtures` (primero los
 * del schedule oficial). Cada partido tiene su editor de marcador y checkbox
 * de doble. Al final, las 4 posiciones de clasificación.
 */
function GroupCard({
  group,
  draft,
  onScoreChange,
  onDoubleToggle,
  onPositionChange,
}: {
  group: string;
  draft: PorraDraft;
  onScoreChange: (id: string, side: "home" | "away", v: string) => void;
  onDoubleToggle: (group: string, id: string, checked: boolean) => void;
  onPositionChange: (group: string, idx: number, v: string) => void;
}) {
  const fixtures = getGroupFixtures(group);
  const selectedDoubles = draft.doubleMatches[group] || [];

  // Dividir los 6 partidos en 3 jornadas (2 partidos cada una).
  // getGroupFixtures ya devuelve los partidos en orden cronológico,
  // así que basta con agruparlos de 2 en 2.
  const jornadas = [
    { label: "Jornada 1", matches: fixtures.slice(0, 2) },
    { label: "Jornada 2", matches: fixtures.slice(2, 4) },
    { label: "Jornada 3", matches: fixtures.slice(4, 6) },
  ];

  return (
    <article className="card admin-group-card">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <GroupBadge group={group} />
          <p className="mt-2 text-[11px] text-text-muted">
            6 marcadores, 1 partido doble, orden final.
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

      {/* Partidos divididos por jornadas */}
      <div className="space-y-3">
        {jornadas.map((jornada) => (
          <div key={jornada.label}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">
              {jornada.label}
            </p>
            <div className="space-y-2">
              {jornada.matches.map((fixture) => {
                const pick = draft.matchPicks[fixture.id];
                const isDouble = selectedDoubles.includes(fixture.id);
                return (
                  <FixtureRow
                    key={fixture.id}
                    homeTeam={fixture.homeTeam}
                    awayTeam={fixture.awayTeam}
                    homeScore={pick?.home ?? ""}
                    awayScore={pick?.away ?? ""}
                    isDouble={isDouble}
                    onHomeChange={(v) => onScoreChange(fixture.id, "home", v)}
                    onAwayChange={(v) => onScoreChange(fixture.id, "away", v)}
                    onDoubleChange={(checked) =>
                      onDoubleToggle(group, fixture.id, checked)
                    }
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Posiciones finales */}
      <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgb(var(--border-subtle))" }}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">
          Clasificación final
        </p>
        <div className="admin-position-grid">
          {GROUP_SLOT_LABELS.map((label, index) => (
            <label key={`${group}-${label}`} className="admin-field-block !p-0">
              <span className="admin-slot-label">{label}</span>
              <select
                className="input-field admin-select !py-2 !text-[13px]"
                value={draft.groupOrderPicks[group]?.[index] || ""}
                onChange={(e) => onPositionChange(group, index, e.target.value)}
              >
                <option value="">Seleccionar</option>
                {GROUPS[group].map((team) => (
                  <option key={`${group}-${team}`} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>
    </article>
  );
}

/**
 * Fila de un partido con editor de marcador. La estructura está ahora limpia:
 * equipo+bandera a la izquierda, score editor centrado, equipo+bandera a la
 * derecha. El partido doble se indica con borde dorado. Resuelve el problema
 * de "Corea del Sur" partido junto a la bandera al limitar el ancho del nombre
 * de equipo y darle espacio a la bandera.
 */
function FixtureRow({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  isDouble,
  onHomeChange,
  onAwayChange,
  onDoubleChange,
}: {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | string;
  awayScore: number | string;
  isDouble: boolean;
  onHomeChange: (v: string) => void;
  onAwayChange: (v: string) => void;
  onDoubleChange: (checked: boolean) => void;
}) {
  return (
    <div
      className="rounded-xl p-2.5"
      style={{
        background: "rgb(var(--bg-elevated))",
        border: "1px solid rgb(var(--border-subtle))",
        borderLeft: isDouble
          ? "3px solid rgb(var(--gold))"
          : "3px solid rgb(var(--border-subtle))",
      }}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {/* Equipo casa */}
        <div className="flex items-center gap-1.5 justify-end min-w-0">
          <span className="text-xs font-medium text-text-warm truncate text-right">
            {homeTeam}
          </span>
          <Flag country={homeTeam} size="sm" />
        </div>

        {/* Editor de marcador */}
        <div className="admin-score-editor">
          <input
            className="admin-score-input"
            inputMode="numeric"
            type="number"
            min={0}
            step={1}
            placeholder="-"
            value={homeScore}
            onChange={(e) => onHomeChange(e.target.value)}
            aria-label={`Goles ${homeTeam}`}
          />
          <span className="admin-score-separator">-</span>
          <input
            className="admin-score-input"
            inputMode="numeric"
            type="number"
            min={0}
            step={1}
            placeholder="-"
            value={awayScore}
            onChange={(e) => onAwayChange(e.target.value)}
            aria-label={`Goles ${awayTeam}`}
          />
        </div>

        {/* Equipo visitante */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Flag country={awayTeam} size="sm" />
          <span className="text-xs font-medium text-text-warm truncate">
            {awayTeam}
          </span>
        </div>
      </div>

      <label className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-text-muted cursor-pointer">
        <input
          type="checkbox"
          checked={isDouble}
          onChange={(e) => onDoubleChange(e.target.checked)}
          className="cursor-pointer"
        />
        Partido doble
      </label>
    </div>
  );
}

function KnockoutRoundGrid({
  title,
  matches,
  round,
  onWinnerChange,
}: {
  title: string;
  matches: ReturnType<typeof getRound32Matches>;
  round: "round32" | "round16" | "quarter" | "semi";
  onWinnerChange: (round: "round32" | "round16" | "quarter" | "semi", matchId: string, value: string) => void;
}) {
  if (matches.length === 0) return null;

  return (
    <div className="mb-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">
        {title}
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        {matches.map((match) => (
          <KnockoutWinnerCard
            key={`${round}-${match.matchId}`}
            matchId={match.matchId}
            homeTeam={match.homeTeam}
            awayTeam={match.awayTeam}
            homeLabel={match.homeLabel}
            awayLabel={match.awayLabel}
            winner={match.winner}
            onWinnerChange={(value) => onWinnerChange(round, match.matchId, value)}
          />
        ))}
      </div>
    </div>
  );
}

function KnockoutWinnerCard({
  matchId,
  homeTeam,
  awayTeam,
  homeLabel,
  awayLabel,
  winner,
  onWinnerChange,
}: {
  matchId: string;
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
    <article className="card admin-round-card !p-3">
      <p className="mb-2 text-[10px] font-mono text-text-faint">#{matchId}</p>
      <div className="space-y-1.5">
        {teams.map(({ team, label }) => (
          <button
            key={`${matchId}-${label}`}
            type="button"
            className="w-full rounded-xl border px-3 py-2 text-left transition-all"
            style={{
              borderColor:
                winner === team && team
                  ? "rgba(var(--gold), 0.4)"
                  : "rgb(var(--border-subtle))",
              background:
                winner === team && team
                  ? "rgb(var(--gold-soft))"
                  : "rgb(var(--bg-elevated))",
            }}
            onClick={() => team && onWinnerChange(team)}
            disabled={!team || disabled}
          >
            <div className="flex items-center justify-between gap-3">
              <TeamLabel team={team} fallback={label} />
              {winner === team && team ? (
                <span className="badge badge-gold text-[9px]">Clasifica</span>
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
        className="input-field admin-select mt-1.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Seleccionar</option>
        {options.map((option) => (
          <option key={`${label}-${option}`} value={option}>
            {option}
          </option>
        ))}
      </select>
      {value ? <CountrySelectionPreview country={value} emptyLabel="Sin selección" /> : null}
    </label>
  );
}

function TeamLabel({ team, fallback }: { team: string; fallback: string }) {
  if (!team) {
    return <span className="text-xs text-text-muted">{fallback}</span>;
  }
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-text-warm min-w-0">
      <Flag country={team} size="sm" />
      <span className="truncate">{team}</span>
    </span>
  );
}
