"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ChevronLeft, Check, Save, Sparkles, Trophy, Users } from "lucide-react";
import { Flag, GroupBadge, SectionTitle } from "@/components/ui";
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
import { notifyUserTeamsUpdated } from "@/lib/use-scored-participants";

const GROUP_SLOT_LABELS = ["1.º", "2.º", "3.º", "4.º"] as const;

type BuilderUser = {
  id: string;
  username: string;
};

export function MiPorraBuilder({
  user,
  onSaved,
  onCancel,
}: {
  user: BuilderUser;
  onSaved: (teamId: string) => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<PorraDraft>(() => createEmptyPorraDraft(user.id, user.username));
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
      return {
        ...current,
        bestThirdGroups: selected,
      };
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

  const updateWinner = (round: "round32" | "round16" | "quarter" | "semi", matchId: string, value: string) => {
    setSaveError("");
    setDraft((current) => ({
      ...current,
      roundWinners: {
        ...current.roundWinners,
        [round]: {
          ...current.roundWinners[round],
          [matchId]: value,
        },
      },
    }));
  };

  const updatePodium = (field: "championPick" | "runnerUpPick" | "thirdPlacePick", value: string) => {
    setSaveError("");
    setDraft((current) => {
      const next = {
        ...current,
        [field]: value,
      };
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
      specials: {
        ...current.specials,
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    const currentErrors = validatePorraDraft(draft);
    if (currentErrors.length > 0) {
      setSaveError(currentErrors[0]);
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
      notifyUserTeamsUpdated();
      onSaved(entry.id);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se ha podido guardar la porra.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[920px] px-4 pt-4 pb-32">
      <div className="page-header animate-fade-in">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/15 bg-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-light">
            <Trophy size={12} />
            Mi Porra
          </div>
          <h1 className="page-header__title mt-3">Rellena tu porra</h1>
          <p className="mt-2 text-sm text-text-muted">
            Completa resultados de grupos, partido doble, mejores terceros, cuadro eliminatorio, podio y especiales. Al guardar, la porra quedará bloqueada en modo lectura.
          </p>
        </div>

        {onCancel ? (
          <button type="button" className="btn btn-ghost !px-3.5 !py-2 text-xs" onClick={onCancel}>
            <ChevronLeft size={14} />
            Volver
          </button>
        ) : null}
      </div>

      {saveError || errors.length ? (
        <div className="card mb-5 border border-danger/20 bg-danger/10 animate-fade-in">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-danger/20 bg-danger/15 text-danger">
              <AlertCircle size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-text-warm">Revisa la porra antes de guardar</p>
              <ul className="mt-2 space-y-1 text-xs text-text-muted">
                {saveError ? <li>{saveError}</li> : null}
                {!saveError
                  ? errors.slice(0, 6).map((error) => <li key={error}>• {error}</li>)
                  : errors.slice(0, 5).map((error) => <li key={error}>• {error}</li>)}
                {errors.length > 6 ? <li>• Hay más campos pendientes por completar.</li> : null}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

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
                    <p className="mt-2 text-[11px] text-text-muted">Marca los 6 resultados, el partido doble y el orden final.</p>
                  </div>
                  <span className={`badge ${selectedDoubles.length === 1 ? "badge-green" : selectedDoubles.length > 1 ? "badge-red" : "badge-muted"}`}>
                    Doble {selectedDoubles.length}/1
                  </span>
                </div>

                <div className="space-y-2.5">
                  {fixtures.map((fixture) => {
                    const pick = draft.matchPicks[fixture.id];
                    const checked = selectedDoubles.includes(fixture.id);
                    return (
                      <div key={fixture.id} className="card admin-match-editor-card !p-3" style={{ borderLeft: checked ? "3px solid #DFBE38" : "3px solid transparent" }}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="badge badge-muted text-[10px]">{fixture.round}</span>
                          <label className="inline-flex items-center gap-2 text-[11px] text-text-muted">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => toggleDoubleMatch(group, fixture.id, event.target.checked)}
                            />
                            Partido doble
                          </label>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <div className="flex flex-1 items-center justify-end gap-1.5 text-right">
                            <span className="text-xs font-medium text-text-warm">{fixture.homeTeam}</span>
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
                              value={pick?.home}
                              onChange={(event) => updateMatchScore(fixture.id, "home", event.target.value)}
                            />
                            <span className="admin-score-separator">-</span>
                            <input
                              className="admin-score-input"
                              inputMode="numeric"
                              type="number"
                              min={0}
                              step={1}
                              placeholder="-"
                              value={pick?.away}
                              onChange={(event) => updateMatchScore(fixture.id, "away", event.target.value)}
                            />
                          </div>
                          <div className="flex flex-1 items-center gap-1.5 text-left">
                            <Flag country={fixture.awayTeam} size="sm" />
                            <span className="text-xs font-medium text-text-warm">{fixture.awayTeam}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 admin-position-grid">
                  {GROUP_SLOT_LABELS.map((label, index) => (
                    <label key={`${group}-${label}`} className="card admin-field-block">
                      <span className="admin-slot-label">{label}</span>
                      <select
                        className="input-field admin-select"
                        value={draft.groupOrderPicks[group]?.[index] || ""}
                        onChange={(event) => updateGroupPosition(group, index, event.target.value)}
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
              </article>
            );
          })}
        </div>
      </section>

      <section className="mb-5 animate-fade-in" style={{ animationDelay: "0.06s" }}>
        <SectionTitle accent="#D9B449" icon={Trophy}>Mejores terceros</SectionTitle>
        <div className="card mb-3">
          <p className="text-sm text-text-muted">Selecciona qué 8 terceros avanzan y asigna cada uno a su cruce de dieciseisavos.</p>
          <p className="mt-1 text-[11px] text-text-muted">Seleccionados: {draft.bestThirdGroups.length}/8</p>
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
                  <span className={`badge ${selected ? "badge-gold" : "badge-muted"}`}>{selected ? "Avanza" : "No"}</span>
                </div>
                <p className="text-sm font-semibold text-text-warm">{thirdTeam || "3.º pendiente"}</p>
                <p className="mt-1 text-[11px] text-text-muted">Solo aparecerá en los cruces compatibles si está marcado.</p>
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
                    {match.homeTeam || match.homeLabel} vs mejor tercero de {match.awayLabel.replace("3", "")}
                  </p>
                  <select
                    className="input-field admin-select"
                    value={draft.bestThirdAssignments[match.matchId] || ""}
                    onChange={(event) => updateBestThirdAssignment(match.matchId, event.target.value)}
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-light">Final automática</p>
          <div className="mt-3 flex items-center justify-center gap-3">
            <TeamLabel team={finalParticipants.homeTeam} fallback={finalParticipants.homeLabel} />
            <span className="font-display text-base font-black text-gold">vs</span>
            <TeamLabel team={finalParticipants.awayTeam} fallback={finalParticipants.awayLabel} />
          </div>
        </div>
      </section>

      <section className="mb-5 animate-fade-in" style={{ animationDelay: "0.12s" }}>
        <SectionTitle accent="#D4AF37" icon={Trophy}>Podio</SectionTitle>
        <div className="grid gap-3 md:grid-cols-3">
          <SelectCard label="Campeón" value={draft.championPick} options={ALL_TEAMS_SORTED} onChange={(value) => updatePodium("championPick", value)} />
          <SelectCard label="Subcampeón" value={draft.runnerUpPick} options={ALL_TEAMS_SORTED} onChange={(value) => updatePodium("runnerUpPick", value)} />
          <SelectCard label="Tercer puesto" value={draft.thirdPlacePick} options={ALL_TEAMS_SORTED} onChange={(value) => updatePodium("thirdPlacePick", value)} />
        </div>
      </section>

      <section className="animate-fade-in" style={{ animationDelay: "0.15s" }}>
        <SectionTitle accent="#F0417A" icon={Sparkles}>Especiales</SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          {ADMIN_SPECIAL_FIELDS.map((field) => {
            const key = field.key as keyof PorraDraft["specials"];
            const value = draft.specials[key];
            return field.kind === "team" ? (
              <SelectCard key={field.key} label={field.label} value={String(value ?? "")} options={ALL_TEAMS_SORTED} onChange={(nextValue) => updateSpecial(key, nextValue)} />
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

      <div className="admin-savebar">
        <div className="min-w-0">
          <p className="admin-savebar-title">Porra pendiente de entrega</p>
          <p className="admin-savebar-text">Máximo 3 porras por usuario. Al guardar quedará en modo solo lectura.</p>
        </div>
        <button type="button" className="btn btn-primary admin-savebar-button" onClick={() => void handleSave()} disabled={saving || errors.length > 0}>
          {saving ? <Check size={16} /> : <Save size={16} />}
          {saving ? "Guardando..." : "Guardar porra"}
        </button>
      </div>
    </div>
  );
}

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
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">{title}</p>
      <div className="space-y-2">
        {teams.map(({ team, label }) => (
          <button
            key={`${title}-${label}`}
            type="button"
            className={`w-full rounded-2xl border px-3 py-2.5 text-left transition-all ${winner === team && team ? "border-gold/30 bg-gold/10" : "border-[rgb(var(--divider)/0.08)] bg-[rgb(var(--bg-3)/0.62)]"}`}
            onClick={() => team && onWinnerChange(team)}
            disabled={!team || disabled}
          >
            <div className="flex items-center justify-between gap-3">
              <TeamLabel team={team} fallback={label} />
              {winner === team && team ? <span className="badge badge-gold">Clasifica</span> : null}
            </div>
          </button>
        ))}
      </div>
    </article>
  );
}

function SelectCard({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="card admin-field-block">
      <span className="admin-field-label">{label}</span>
      <select className="input-field admin-select" value={value} onChange={(event) => onChange(event.target.value)}>
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
