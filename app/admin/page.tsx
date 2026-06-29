"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, ArrowDownUp, BarChart3, Check, ChevronDown, ChevronUp, Clock3, Edit2, Eye, EyeOff,
  KeyRound, LayoutGrid, ListFilter, Loader2, LogOut, MapPin, RefreshCw, Save, Shield, Sparkles, Tag, Trash2,
  Trophy, UserCheck, UserPlus, Users, UserX, Crown,
} from "lucide-react";
import { CountrySelectionPreview, Flag, GroupBadge, SectionTitle } from "@/components/ui";
import { UserBadge } from "@/components/UserBadge";
import { MiPorraBuilder } from "@/components/mi-porra-builder";
import { GROUPS, type Team } from "@/lib/data";
import {
  ADMIN_SPECIAL_FIELDS,
  ALL_TEAMS_SORTED,
  BEST_THIRD_SLOTS,
  KNOCKOUT_ADMIN_COUNTS,
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
import { computePorraCompleteness } from "@/lib/porra-completeness";
import { STAGE_LABELS, STAGE_ORDER, WORLD_CUP_MATCHES, type MatchStage, type WorldCupMatch } from "@/lib/worldcup/schedule";
import { notifyAdminResultsUpdated, useScoredParticipants } from "@/lib/use-scored-participants";
import { ImportFinishedFromApi } from "@/components/admin/import-finished-button";

const GROUP_SLOT_ORDER: Array<Exclude<GroupPositionValue, 0>> = [1, 2, 3, 4];
const GROUP_SLOT_LABELS: Record<Exclude<GroupPositionValue, 0>, string> = {
  1: "1.º", 2: "2.º", 3: "3.º", 4: "Eliminado",
};

type ResultsViewMode = "group" | "phase";
type AdminTab = "resultados" | "porras" | "progreso" | "usuarios" | "copa";

type GroupStandingRow = {
  team: string; played: number; win: number; draw: number; lose: number;
  gf: number; ga: number; gd: number; points: number;
};

const GROUP_MATCHES_BY_GROUP = Object.keys(GROUPS).reduce<Record<string, WorldCupMatch[]>>((acc, group) => {
  acc[group] = WORLD_CUP_MATCHES.filter(
    (match) => match.stage === "group" &&
      GROUPS[group].includes(match.homeTeam) && GROUPS[group].includes(match.awayTeam)
  );
  return acc;
}, {});

function serializeAdminResults(data: AdminResults) { return JSON.stringify(sanitizeAdminResults(data)); }

function isGroupComplete(group: string, data: AdminResults) {
  const values = GROUPS[group].map((team) => data.groupPositions[team]).filter((v) => v > 0);
  if (values.length !== 4) return false;
  return new Set(values).size === 4;
}

function getRoundUniqueCount(roundKey: KnockoutRoundKey, data: AdminResults) {
  return new Set(data.knockoutRounds[roundKey].filter(Boolean)).size;
}

function isRoundComplete(roundKey: KnockoutRoundKey, data: AdminResults) {
  return getRoundUniqueCount(roundKey, data) === KNOCKOUT_ADMIN_COUNTS[roundKey];
}

function countConfiguredMatchResults(data: AdminResults) {
  return Object.values(data.matchResults).filter(
    (v) => typeof v.home === "number" && typeof v.away === "number"
  ).length;
}

function getTeamForGroupPosition(group: string, position: Exclude<GroupPositionValue, 0>, data: AdminResults) {
  return GROUPS[group].find((team) => data.groupPositions[team] === position) || "";
}

function buildStandingRow(team: string): GroupStandingRow {
  return { team, played: 0, win: 0, draw: 0, lose: 0, gf: 0, ga: 0, gd: 0, points: 0 };
}

function computeGroupStandings(group: string, data: AdminResults) {
  const rows = GROUPS[group].reduce<Record<string, GroupStandingRow>>((acc, team) => {
    acc[team] = buildStandingRow(team); return acc;
  }, {});
  GROUP_MATCHES_BY_GROUP[group].forEach((match) => {
    const result = data.matchResults[String(match.id)];
    if (typeof result?.home !== "number" || typeof result?.away !== "number") return;
    const home = rows[match.homeTeam];
    const away = rows[match.awayTeam];
    home.played += 1; away.played += 1;
    home.gf += result.home; home.ga += result.away;
    away.gf += result.away; away.ga += result.home;
    if (result.home > result.away) { home.win += 1; away.lose += 1; home.points += 3; }
    else if (result.home < result.away) { away.win += 1; home.lose += 1; away.points += 3; }
    else { home.draw += 1; away.draw += 1; home.points += 1; away.points += 1; }
    home.gd = home.gf - home.ga; away.gd = away.gf - away.ga;
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
  if (mode === "group") return GROUP_MATCHES_BY_GROUP[selectedGroup] || [];
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
  const [activeTab, setActiveTab] = useState<AdminTab>("resultados");
  const { participants } = useScoredParticipants();
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await fetch("/api/admin-results?raw=1", { cache: "no-store" });
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
        if (mounted) setReady(true);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (saveState !== "saved") return undefined;
    const timeout = window.setTimeout(() => setSaveState("idle"), 2200);
    return () => window.clearTimeout(timeout);
  }, [saveState]);

  const dirty = useMemo(() => serializeAdminResults(form) !== snapshot, [form, snapshot]);
  const configuredMatchCount = useMemo(() => countConfiguredMatchResults(form), [form]);
  const completedGroups = useMemo(() => Object.keys(GROUPS).filter((g) => isGroupComplete(g, form)).length, [form]);
  const filteredMatches = useMemo(() => getFilteredMatches(resultsMode, selectedGroup, selectedStage), [resultsMode, selectedGroup, selectedStage]);

  const touchForm = () => { setSaveState("idle"); setSaveError(""); };

  const handleLogout = async () => {
    if (dirty && !window.confirm("Tienes cambios sin guardar. ¿Cerrar sesión igualmente?")) return;
    try { await fetch("/api/admin/logout", { method: "POST" }); }
    finally { window.location.replace("/admin/login"); }
  };

  const handleMatchScoreChange = (matchId: number, side: "home" | "away", value: string) => {
    const parsed = value === "" ? null : Math.max(0, Math.floor(Number(value)));
    touchForm();
    setForm((current) => {
      const currentResult = current.matchResults[String(matchId)] || { home: null, away: null, statusShort: "NS" as const };
      const nextResult = { ...currentResult, [side]: Number.isFinite(parsed as number) ? parsed : null };
      const hasBoth = typeof nextResult.home === "number" && typeof nextResult.away === "number";
      return {
        ...current,
        matchResults: {
          ...current.matchResults,
          [String(matchId)]: { home: nextResult.home, away: nextResult.away, statusShort: hasBoth ? "FT" : "NS" },
        },
      };
    });
  };

  const handleClearMatchResult = (matchId: number) => {
    touchForm();
    setForm((current) => ({
      ...current,
      matchResults: { ...current.matchResults, [String(matchId)]: { home: null, away: null, statusShort: "NS" } },
    }));
  };

  const handleGroupSlotChange = (group: string, position: Exclude<GroupPositionValue, 0>, value: string) => {
    touchForm();
    setForm((current) => {
      const nextPositions = { ...current.groupPositions };
      GROUPS[group].forEach((team) => { if (nextPositions[team] === position) nextPositions[team] = 0; });
      if (value) nextPositions[value] = position;
      return { ...current, groupPositions: nextPositions };
    });
  };

  const handleRoundChange = (roundKey: KnockoutRoundKey, index: number, value: string) => {
    touchForm();
    setForm((current) => {
      const nextRound = [...current.knockoutRounds[roundKey]];
      if (value) nextRound.forEach((team, i) => { if (i !== index && team === value) nextRound[i] = ""; });
      nextRound[index] = value;
      return { ...current, knockoutRounds: { ...current.knockoutRounds, [roundKey]: nextRound } };
    });
  };

  const handleBestThirdChange = (slot: string, group: string) => {
    touchForm();
    setForm((current) => {
      const next: Record<string, string> = { ...(current.bestThirdAssignments || {}) };
      if (group) {
        // Un mismo grupo solo puede ocupar un hueco de tercero.
        for (const k of Object.keys(next)) { if (next[k] === group) delete next[k]; }
        next[slot] = group;
      } else {
        delete next[slot];
      }
      return { ...current, bestThirdAssignments: next };
    });
  };

  const handlePodiumChange = (field: "campeon" | "subcampeon" | "tercero", value: string) => {
    touchForm();
    setForm((current) => {
      const next = { ...current.podium, [field]: value };
      (["campeon", "subcampeon", "tercero"] as const).forEach((k) => {
        if (k !== field && value && next[k] === value) next[k] = "";
      });
      return { ...current, podium: next };
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
    setSaving(true); setSaveError(""); setSaveState("idle");
    try {
      const response = await fetch("/api/admin-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "No se han podido guardar los cambios");
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

  if (editingTeam) {
    return (
      <div className="mx-auto max-w-[920px] px-4 pt-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="badge badge-gold text-[10px]">Admin</span>
          <span className="text-xs text-text-muted">Editando porra de @{editingTeam.username}</span>
        </div>
        <MiPorraBuilder
          user={{ id: editingTeam.userId, username: editingTeam.username }}
          onSaved={() => { setEditingTeam(null); notifyAdminResultsUpdated(); }}
          onCancel={() => setEditingTeam(null)}
          initialTeam={editingTeam}
        />
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="mx-auto max-w-[920px] px-4 pt-4 pb-28">
        <div className="space-y-3">
          <div className="skeleton" style={{ height: 96 }} />
          <div className="skeleton" style={{ height: 280 }} />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-[920px] px-4 pt-4 pb-32">
        {/* Header */}
        <div className="page-header animate-fade-in">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/15 bg-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-light">
              <Shield size={12} /> Admin
            </div>
            <h1 className="page-header__title mt-3">Panel de control</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="badge badge-muted">{formatAdminSavedAt(form.savedAt)}</span>
            <span className={`badge ${dirty ? "badge-amber" : "badge-green"}`}>{dirty ? "Cambios pendientes" : "Sincronizado"}</span>
            <button type="button" className="btn btn-ghost !px-3 !py-2 text-xs" onClick={() => void handleLogout()}>
              <LogOut size={14} /> Cerrar sesión
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto">
          <button className={`pill whitespace-nowrap ${activeTab === "resultados" ? "active" : ""}`} onClick={() => setActiveTab("resultados")}>
            <Trophy size={14} /> Resultados
          </button>
          <button className={`pill whitespace-nowrap ${activeTab === "porras" ? "active" : ""}`} onClick={() => setActiveTab("porras")}>
            <Users size={14} /> Porras ({participants.length})
          </button>
          <button className={`pill whitespace-nowrap ${activeTab === "progreso" ? "active" : ""}`} onClick={() => setActiveTab("progreso")}>
            <BarChart3 size={14} /> Progreso
          </button>
          <button className={`pill whitespace-nowrap ${activeTab === "usuarios" ? "active" : ""}`} onClick={() => setActiveTab("usuarios")}>
            <UserPlus size={14} /> Usuarios
          </button>
          <button className={`pill whitespace-nowrap ${activeTab === "copa" ? "active" : ""}`} onClick={() => setActiveTab("copa")}>
            <Crown size={14} /> Copa
          </button>
        </div>

        {/* ════ TAB: RESULTADOS ════ */}
        {activeTab === "resultados" && (
          <>
            <section className="mb-5 animate-fade-in">
              <SectionTitle accent="#C99625" icon={Trophy}>Resultados oficiales</SectionTitle>
              <ImportFinishedFromApi form={form} onApply={(next) => { touchForm(); setForm(next); }} />
              <div className="card admin-results-toolbar">
                <div className="admin-results-toolbar-row">
                  <div className="admin-results-toggle">
                    <button type="button" className={`pill ${resultsMode === "group" ? "active" : ""}`}
                      onClick={() => { setResultsMode("group"); setSelectedStage("group"); }}>
                      <LayoutGrid size={14} /> Por grupo
                    </button>
                    <button type="button" className={`pill ${resultsMode === "phase" ? "active" : ""}`}
                      onClick={() => setResultsMode("phase")}>
                      <ListFilter size={14} /> Por fase
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
                        <button key={group} type="button" className={`pill ${selectedGroup === group ? "active" : ""}`}
                          onClick={() => setSelectedGroup(group)}>Grupo {group}</button>
                      ))
                    : STAGE_ORDER.map((stage) => (
                        <button key={stage} type="button" className={`pill ${selectedStage === stage ? "active" : ""}`}
                          onClick={() => setSelectedStage(stage)}>{STAGE_LABELS[stage]}</button>
                      ))}
                </div>
              </div>
              <div className="mt-3 grid gap-3">
                {filteredMatches.map((match) => (
                  <AdminMatchEditorCard key={match.id} match={match}
                    result={form.matchResults[String(match.id)]}
                    onScoreChange={handleMatchScoreChange} onClear={handleClearMatchResult} />
                ))}
              </div>
            </section>

            <section className="mb-5 animate-fade-in">
              <SectionTitle accent="#55BCBB" icon={Users}
                right={<span className="badge badge-muted">{completedGroups}/12 completos</span>}>
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
                      <div className="admin-position-layout">
                        <div className="admin-position-stack">
                          <p className="admin-field-label">Orden manual</p>
                          {GROUP_SLOT_ORDER.map((position) => (
                            <label key={`${group}-${position}`} className="admin-position-row">
                              <span className="admin-position-slot">{GROUP_SLOT_LABELS[position]}</span>
                              <select className="input-field admin-select admin-position-select"
                                value={getTeamForGroupPosition(group, position, form)}
                                onChange={(e) => handleGroupSlotChange(group, position, e.target.value)}>
                                <option value="">Seleccionar equipo</option>
                                {GROUPS[group].map((team) => (
                                  <option key={`${group}-${position}-${team}`} value={team}>{team}</option>
                                ))}
                              </select>
                            </label>
                          ))}
                        </div>
                        <div className="admin-position-preview">
                          <p className="admin-field-label">Vista guardada</p>
                          <div className="mt-2 space-y-1.5">
                            {GROUP_SLOT_ORDER.map((position) => {
                              const team = getTeamForGroupPosition(group, position, form);
                              return (
                                <div key={`${group}-preview-${position}`} className="admin-preview-row">
                                  <span className="admin-preview-rank">{GROUP_SLOT_LABELS[position]}</span>
                                  {team
                                    ? <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-text-warm">
                                        <Flag country={team} size="sm" /><span className="truncate">{team}</span>
                                      </span>
                                    : <span className="text-[12px] text-text-muted">Sin asignar</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="admin-standings-block">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="admin-field-label">Clasificación según marcadores</p>
                          <span className="text-[10px] text-text-muted">{hasScoredMatches ? "Orientativa" : "Sin partidos"}</span>
                        </div>
                        {hasScoredMatches
                          ? <div className="space-y-1.5">
                              {standings.map((row, index) => (
                                <div key={`${group}-standing-${row.team}`} className="admin-standings-row">
                                  <span className="admin-standings-rank">{index + 1}</span>
                                  <div className="admin-standings-team">
                                    <Flag country={row.team} size="sm" />
                                    <span className="truncate text-[12px] font-semibold text-text-warm">{row.team}</span>
                                  </div>
                                  <div className="admin-standings-metrics">
                                    <span>PJ {row.played}</span><span>DG {row.gd}</span>
                                    <span className="admin-standings-points">{row.points} pts</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          : <p className="text-[12px] leading-5 text-text-muted">Introduce resultados para ver la tabla orientativa.</p>}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="mb-5 animate-fade-in">
              <SectionTitle accent="#C99625" icon={Sparkles}>Eliminatorias</SectionTitle>
              <div className="grid gap-3">
                {(Object.keys(KNOCKOUT_ADMIN_COUNTS) as KnockoutRoundKey[]).map((roundKey) => (
                  <article key={roundKey} className="card admin-round-card">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <h3 className="font-display text-[18px] font-black text-text-warm">{KNOCKOUT_LABELS[roundKey]}</h3>
                        <p className="mt-1 text-[11px] text-text-muted">
                          {getRoundUniqueCount(roundKey, form)}/{KNOCKOUT_ADMIN_COUNTS[roundKey]} seleccionados
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
                          <select className="input-field admin-select" value={team}
                            onChange={(e) => handleRoundChange(roundKey, index, e.target.value)}>
                            <option value="">Seleccionar</option>
                            {ALL_TEAMS_SORTED.map((option) => (
                              <option key={`${roundKey}-${option}`} value={option}>{option}</option>
                            ))}
                          </select>
                          {team ? <CountrySelectionPreview country={team} emptyLabel="Sin selección" /> : null}
                        </label>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="mb-5 animate-fade-in">
              <SectionTitle accent="#C99625" icon={Sparkles}>Mejores terceros</SectionTitle>
              <p className="mb-3 text-[12px] leading-5 text-text-muted">
                Asigna cada hueco de tercero de dieciseisavos al grupo cuyo 3.º lo ocupa. El país se toma
                automáticamente del 3.º que hayas marcado en las posiciones de grupo.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {BEST_THIRD_SLOTS.map(({ slot, eligibleGroups }) => {
                  const group = form.bestThirdAssignments?.[slot] || "";
                  const team = group ? getTeamForGroupPosition(group, 3, form) : "";
                  return (
                    <label key={slot} className="card admin-field-block">
                      <span className="admin-field-label">{slot}</span>
                      <select className="input-field admin-select" value={group}
                        onChange={(e) => handleBestThirdChange(slot, e.target.value)}>
                        <option value="">Seleccionar grupo</option>
                        {eligibleGroups.map((g) => (
                          <option key={`${slot}-${g}`} value={g}>Grupo {g}</option>
                        ))}
                      </select>
                      {team
                        ? <CountrySelectionPreview country={team} emptyLabel="Sin selección" />
                        : group
                          ? <p className="mt-1 text-[11px] text-text-muted">Marca el 3.º del Grupo {group} en las posiciones de grupo para ver el país.</p>
                          : null}
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="mb-5 animate-fade-in">
              <SectionTitle accent="#B58A1B" icon={Trophy}>Podio final</SectionTitle>
              <div className="grid gap-3 md:grid-cols-3">
                {(["campeon", "subcampeon", "tercero"] as const).map((field) => {
                  const labels = { campeon: "🥇 Campeón", subcampeon: "🥈 Subcampeón", tercero: "🥉 Tercer puesto" };
                  const value = form.podium[field];
                  return (
                    <label key={field} className="card admin-field-block">
                      <span className="admin-field-label">{labels[field]}</span>
                      <select className="input-field admin-select" value={value}
                        onChange={(e) => handlePodiumChange(field, e.target.value)}>
                        <option value="">Seleccionar</option>
                        {ALL_TEAMS_SORTED.map((team) => (
                          <option key={`${field}-${team}`} value={team}>{team}</option>
                        ))}
                      </select>
                      {value ? <CountrySelectionPreview country={value} emptyLabel="Sin selección" /> : null}
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="animate-fade-in">
              <SectionTitle accent="#D6336F" icon={Sparkles}>Especiales</SectionTitle>
              <div className="grid gap-3 md:grid-cols-2">
                {ADMIN_SPECIAL_FIELDS.map((field) => {
                  const key = field.key as keyof AdminResults["specialResults"];
                  const value = form.specialResults[key];
                  return (
                    <label key={field.key} className="card admin-field-block">
                      <span className="admin-field-label">{field.label}</span>
                      {field.kind === "team" ? (
                        <>
                          <select className="input-field admin-select" value={String(value ?? "")}
                            onChange={(e) => handleSpecialChange(key, e.target.value)}>
                            <option value="">Seleccionar</option>
                            {ALL_TEAMS_SORTED.map((team) => (
                              <option key={`${field.key}-${team}`} value={team}>{team}</option>
                            ))}
                          </select>
                          {value ? <CountrySelectionPreview country={String(value)} emptyLabel="Sin selección" /> : null}
                        </>
                      ) : field.kind === "number" ? (
                        <input className="input-field" inputMode="numeric" type="number" min={0} step={1} placeholder="0"
                          value={typeof value === "number" ? value : ""}
                          onChange={(e) => handleSpecialChange(key, e.target.value)} />
                      ) : (
                        <input className="input-field" placeholder={field.label} value={String(value ?? "")}
                          onChange={(e) => handleSpecialChange(key, e.target.value)} />
                      )}
                    </label>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* ════ TAB: PORRAS ════ */}
        {activeTab === "porras" && (
          <PorrasManagementSection
            participants={participants}
            onEditTeam={setEditingTeam}
            allowNewPorras={form.allowNewPorras}
            onToggleAllowNewPorras={(value) => setForm((current) => ({ ...current, allowNewPorras: value }))}
          />
        )}

        {/* ════ TAB: PROGRESO ════ */}
        {activeTab === "progreso" && <PorrasProgressSection participants={participants} />}

        {/* ════ TAB: USUARIOS ════ */}
        {activeTab === "usuarios" && <UsersManagementSection />}

        {activeTab === "copa" && <CupAdminSection participants={participants} />}
      </div>

      {activeTab === "resultados" && (
        <div className="admin-savebar">
          <div className="min-w-0 flex-1">
            <p className="admin-savebar-title">
              {saveState === "saved" ? "✓ Cambios guardados" : dirty ? "Cambios sin guardar" : "Sin cambios"}
            </p>
            <p className="admin-savebar-text">{formatAdminSavedAt(form.savedAt)}</p>
            {saveError ? <p className="mt-1 text-[11px]" style={{ color: "rgb(var(--danger))" }}>{saveError}</p> : null}
          </div>
          <button type="button" className="btn btn-primary admin-savebar-button"
            onClick={() => void handleSave()}
            disabled={saving || (!dirty && saveState === "idle")}>
            {saveState === "saved" ? <Check size={16} /> : <Save size={16} />}
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      )}

      {saveState === "saved" ? (
        <div className="admin-toast" role="status"><Check size={16} /> Guardado correctamente</div>
      ) : null}
    </>
  );
}

// ════════════════════════════════════════════════════════════
// TAB: GESTIÓN DE USUARIOS
// ════════════════════════════════════════════════════════════

function UsersManagementSection() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [role, setRole] = useState<"user" | "admin">("user");
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // ── Listado de usuarios ──
  type AdminUserRow = {
    id: string;
    username: string;
    displayName: string;
    role: "user" | "admin";
    label: string | null;
    active: boolean;
    createdAt: string;
  };
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tempPw, setTempPw] = useState<Record<string, string>>({});
  const [rowMsg, setRowMsg] = useState<Record<string, { ok: boolean; text: string }>>({});

  const loadUsers = async () => {
    setLoadingUsers(true);
    setUsersError("");
    try {
      const res = await fetch("/api/admin/users/list", { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) {
        setUsersError(payload?.error || "No se han podido cargar los usuarios.");
      } else {
        const list: AdminUserRow[] = payload.users || [];
        setUsers(list);
        setLabelDrafts(Object.fromEntries(list.map((u) => [u.id, u.label || ""])));
      }
    } catch {
      setUsersError("Error de conexión al cargar usuarios.");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleCreate = async () => {
    if (!username.trim() || !password.trim()) {
      setResult({ ok: false, message: "Usuario y contraseña son obligatorios." });
      return;
    }
    setCreating(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim(), displayName: displayName.trim() || username.trim(), role }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setResult({ ok: false, message: payload?.error || "Error al crear el usuario." });
      } else {
        setResult({ ok: true, message: `Usuario @${payload.user.username} creado correctamente.` });
        setUsername(""); setDisplayName(""); setPassword("");
        void loadUsers();
      }
    } catch {
      setResult({ ok: false, message: "Error de conexión." });
    } finally {
      setCreating(false);
    }
  };

  const setRowResult = (id: string, ok: boolean, text: string) =>
    setRowMsg((prev) => ({ ...prev, [id]: { ok, text } }));

  const saveLabel = async (u: AdminUserRow) => {
    setBusyId(u.id);
    try {
      const res = await fetch("/api/admin/users/set-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, label: labelDrafts[u.id] ?? "" }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setRowResult(u.id, false, payload?.error || "Error al guardar la etiqueta.");
      } else {
        setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, label: payload.user.label } : x)));
        setRowResult(u.id, true, "Etiqueta guardada.");
      }
    } catch {
      setRowResult(u.id, false, "Error de conexión.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (u: AdminUserRow) => {
    setBusyId(u.id);
    try {
      const res = await fetch("/api/admin/users/set-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, active: !u.active }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setRowResult(u.id, false, payload?.error || "Error al cambiar el estado.");
      } else {
        setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, active: payload.user.active } : x)));
        setRowResult(u.id, true, payload.user.active ? "Usuario reactivado." : "Usuario dado de baja.");
      }
    } catch {
      setRowResult(u.id, false, "Error de conexión.");
    } finally {
      setBusyId(null);
    }
  };

  const resetPassword = async (u: AdminUserRow) => {
    setBusyId(u.id);
    try {
      const res = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setRowResult(u.id, false, payload?.error || "Error al resetear.");
      } else {
        setTempPw((prev) => ({ ...prev, [u.id]: payload.tempPassword }));
        setRowResult(u.id, true, "Contraseña temporal generada (cópiala y compártela).");
      }
    } catch {
      setRowResult(u.id, false, "Error de conexión.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus size={20} className="text-gold" />
          <h2 className="font-display text-base font-bold text-text-warm">Añadir usuario</h2>
        </div>
        <p className="text-[12px] text-text-muted mb-4">
          Crea un usuario con contraseña. Las credenciales podrán usarse inmediatamente en la pestaña Mi Club
          para iniciar sesión y crear una porra. La contraseña se almacena de forma segura con scrypt.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="admin-field-block">
            <span className="admin-field-label">Nombre de usuario <span className="required-asterisk">*</span></span>
            <input className="input-field" placeholder="ej. juanito" value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))} />
            <span className="text-[10px] text-text-muted">Solo letras, números, _, . y -</span>
          </label>

          <label className="admin-field-block">
            <span className="admin-field-label">Nombre visible</span>
            <input className="input-field" placeholder="ej. Juan García" value={displayName}
              onChange={(e) => setDisplayName(e.target.value)} />
            <span className="text-[10px] text-text-muted">Nombre que aparece en el ranking. Si se deja vacío usa el usuario.</span>
          </label>

          <label className="admin-field-block">
            <span className="admin-field-label">Contraseña <span className="required-asterisk">*</span></span>
            <div className="relative">
              <input className="input-field !pr-10" type={showPass ? "text" : "password"}
                placeholder="Mínimo 4 caracteres" value={password}
                onChange={(e) => setPassword(e.target.value)} />
              <button type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted bg-transparent border-none cursor-pointer"
                onClick={() => setShowPass((v) => !v)}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <label className="admin-field-block">
            <span className="admin-field-label">Rol</span>
            <select className="input-field admin-select" value={role} onChange={(e) => setRole(e.target.value as "user" | "admin")}>
              <option value="user">Usuario (puede crear porras)</option>
              <option value="admin">Admin (acceso al panel)</option>
            </select>
          </label>
        </div>

        {result && (
          <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{
              background: result.ok ? "rgb(var(--success-soft))" : "rgb(var(--danger-soft))",
              border: `1px solid ${result.ok ? "rgba(var(--success),0.3)" : "rgba(var(--danger),0.3)"}`,
            }}>
            {result.ok ? <Check size={14} style={{ color: "rgb(var(--success))" }} /> : <AlertCircle size={14} style={{ color: "rgb(var(--danger))" }} />}
            <p className="text-[12px] font-medium" style={{ color: result.ok ? "rgb(var(--success))" : "rgb(var(--danger))" }}>
              {result.message}
            </p>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button className="btn btn-primary" onClick={() => void handleCreate()} disabled={creating}>
            <UserPlus size={16} />
            {creating ? "Creando usuario..." : "Crear usuario"}
          </button>
        </div>
      </div>

      {/* ── Listado de usuarios ── */}
      <div className="card">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-gold" />
            <h2 className="font-display text-base font-bold text-text-warm">
              Usuarios {users.length > 0 ? `(${users.length})` : ""}
            </h2>
          </div>
          <button className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => void loadUsers()} disabled={loadingUsers}>
            <RefreshCw size={14} /> {loadingUsers ? "Cargando..." : "Recargar"}
          </button>
        </div>

        <p className="text-[11px] text-text-muted mb-4">
          El email no se guarda en la base de datos de la app (se recoge en el formulario de inscripción),
          por eso no aparece aquí. Las contraseñas están cifradas con scrypt y no se pueden mostrar: usa
          &ldquo;Resetear&rdquo; para generar una temporal.
        </p>

        {usersError && (
          <div className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{ background: "rgb(var(--danger-soft))", border: "1px solid rgba(var(--danger),0.3)" }}>
            <AlertCircle size={14} style={{ color: "rgb(var(--danger))" }} />
            <p className="text-[12px] font-medium" style={{ color: "rgb(var(--danger))" }}>{usersError}</p>
          </div>
        )}

        {!loadingUsers && users.length === 0 && !usersError && (
          <p className="text-[12px] text-text-muted">No hay usuarios todavía.</p>
        )}

        <div className="space-y-2.5">
          {users.map((u) => {
            const msg = rowMsg[u.id];
            const temp = tempPw[u.id];
            const busy = busyId === u.id;
            return (
              <div key={u.id} className="rounded-xl border p-3"
                style={{ borderColor: "rgb(var(--border-subtle))", opacity: u.active ? 1 : 0.7 }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <UserBadge username={<span className="text-sm font-semibold text-text-warm">@{u.username}</span>} label={u.label} />
                    <p className="text-[11px] text-text-muted truncate">{u.displayName}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`badge text-[10px] ${u.role === "admin" ? "badge-gold" : "badge-muted"}`}>
                      {u.role === "admin" ? "Admin" : "Usuario"}
                    </span>
                    <span className={`badge text-[10px] ${u.active ? "badge-green" : "badge-red"}`}>
                      {u.active ? "Activo" : "Baja"}
                    </span>
                  </div>
                </div>

                {/* Etiqueta editable */}
                <div className="mt-2.5 flex items-end gap-2">
                  <label className="flex-1 min-w-0">
                    <span className="mb-1 flex items-center gap-1 text-[10px] text-text-muted"><Tag size={11} /> Etiqueta</span>
                    <input
                      className="input-field !py-1.5 text-sm"
                      placeholder="(sin etiqueta)"
                      maxLength={40}
                      value={labelDrafts[u.id] ?? ""}
                      onChange={(e) => setLabelDrafts((prev) => ({ ...prev, [u.id]: e.target.value }))}
                    />
                  </label>
                  <button className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => void saveLabel(u)} disabled={busy}>
                    <Save size={13} /> Guardar
                  </button>
                </div>

                {/* Acciones */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <button className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={() => void resetPassword(u)} disabled={busy}>
                    <KeyRound size={13} /> Resetear contraseña
                  </button>
                  <button
                    className="btn btn-ghost !px-3 !py-1.5 text-xs"
                    onClick={() => void toggleActive(u)}
                    disabled={busy}
                    style={u.active ? { color: "rgb(var(--danger))" } : { color: "rgb(var(--success))" }}
                  >
                    {u.active ? <><UserX size={13} /> Dar de baja</> : <><UserCheck size={13} /> Reactivar</>}
                  </button>
                </div>

                {temp && (
                  <div className="mt-2.5 rounded-lg px-3 py-2 text-[12px]"
                    style={{ background: "rgb(var(--gold-soft, var(--bg-2)))", border: "1px solid rgba(var(--gold),0.3)" }}>
                    Contraseña temporal: <code className="font-mono font-semibold text-text-warm">{temp}</code>
                    <span className="block text-[10px] text-text-muted">Cópiala ahora: no se vuelve a mostrar.</span>
                  </div>
                )}

                {msg && (
                  <p className="mt-2 text-[11px] font-medium"
                    style={{ color: msg.ok ? "rgb(var(--success))" : "rgb(var(--danger))" }}>
                    {msg.text}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <p className="text-[11px] text-text-muted">
          <strong className="text-text-warm">Nota de seguridad:</strong> Las contraseñas se guardan cifradas con scrypt (N=16384).
          Nunca se almacenan en claro. Un usuario dado de baja no puede iniciar sesión hasta que se reactive.
        </p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB: GESTIÓN DE PORRAS
// ════════════════════════════════════════════════════════════

function PorrasManagementSection({ participants, onEditTeam, allowNewPorras, onToggleAllowNewPorras }: { participants: Team[]; onEditTeam: (team: Team) => void; allowNewPorras: boolean; onToggleAllowNewPorras: (value: boolean) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [savingSwitch, setSavingSwitch] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const handleToggleNewPorras = async () => {
    const next = !allowNewPorras;
    setSavingSwitch(true);
    setSwitchError(null);
    try {
      const res = await fetch("/api/admin-results/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowNewPorras: next }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || `Error ${res.status}`);
      onToggleAllowNewPorras(next);
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : "No se ha podido guardar el ajuste");
    } finally {
      setSavingSwitch(false);
    }
  };

  const byUser = useMemo(() => {
    const map = new Map<string, Team[]>();
    participants.filter((p) => !deletedIds.has(p.id)).forEach((p) => {
      const list = map.get(p.username) || [];
      list.push(p);
      map.set(p.username, list);
    });
    return map;
  }, [participants, deletedIds]);

  const handleDelete = async (team: Team) => {
    setDeletingId(team.id);
    setDeleteError(null);
    try {
      const response = await fetch("/api/user-teams/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: team.id, userId: team.userId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Error al eliminar");
      setDeletedIds((prev) => new Set([...prev, team.id]));
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Error al eliminar la porra");
    } finally {
      setDeletingId(null);
    }
  };

  const newPorrasSwitch = (
    <div className="card mb-4" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          role="switch"
          aria-checked={allowNewPorras}
          onClick={() => void handleToggleNewPorras()}
          disabled={savingSwitch}
          style={{
            position: "relative",
            width: 44,
            height: 24,
            borderRadius: 999,
            border: "1px solid " + (allowNewPorras ? "rgba(62,155,79,0.5)" : "rgb(var(--border-default))"),
            background: allowNewPorras ? "rgba(62,155,79,0.35)" : "rgba(255,255,255,0.06)",
            cursor: savingSwitch ? "wait" : "pointer",
            transition: "background 160ms ease",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: allowNewPorras ? 22 : 2,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: allowNewPorras ? "#3E9B4F" : "rgb(var(--text-muted))",
              transition: "left 160ms ease, background 160ms ease",
            }}
          />
        </button>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <p className="text-[12px] font-semibold text-text-warm" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
            {savingSwitch ? <Loader2 size={13} className="animate-spin" /> : null}
            Permitir crear nuevas porras
            <span
              className="text-[9px] font-bold uppercase tracking-widest"
              style={{ color: allowNewPorras ? "#3E9B4F" : "rgb(var(--text-muted))" }}
            >
              {allowNewPorras ? "Habilitado" : "Bloqueado"}
            </span>
          </p>
          <p className="text-[11px] text-text-muted" style={{ margin: 0 }}>
            {allowNewPorras
              ? "Los usuarios pueden crear porras nuevas (hasta 3 por usuario)."
              : "Creación de porras nuevas bloqueada. Editar y eliminar las existentes sigue disponible."}
          </p>
        </div>
      </div>
      {switchError ? (
        <p role="status" className="text-[11px]" style={{ margin: 0, color: "rgb(var(--danger))" }}>
          {switchError}
        </p>
      ) : null}
    </div>
  );

  if (byUser.size === 0) {
    return (
      <div className="space-y-4 animate-fade-in">
        {newPorrasSwitch}
        <div className="card text-center py-10"><p className="text-text-muted text-sm">No hay porras guardadas.</p></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {newPorrasSwitch}
      {deleteError && (
        <div className="card !border-danger/20" style={{ background: "rgb(var(--danger-soft))" }}>
          <p className="text-sm text-danger">{deleteError}</p>
        </div>
      )}
      <p className="text-[11px] text-text-muted">{participants.filter((p) => !deletedIds.has(p.id)).length} porras de {byUser.size} usuarios.</p>
      {Array.from(byUser.entries()).map(([username, teams]) => (
        <div key={username} className="card">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-display text-sm font-bold text-text-warm">@{username}</span>
            <span className="badge badge-muted text-[9px]">{teams.length} porra{teams.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-2">
            {teams.map((team) => {
              const isExpanded = expandedId === team.id;
              return (
                <div key={team.id} className="rounded-xl border" style={{ borderColor: "rgb(var(--border-subtle))" }}>
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <button className="flex items-center gap-2 text-left flex-1 min-w-0"
                      onClick={() => setExpandedId(isExpanded ? null : team.id)}>
                      {isExpanded ? <ChevronUp size={14} className="text-text-muted flex-shrink-0" /> : <ChevronDown size={14} className="text-text-muted flex-shrink-0" />}
                      <span className="text-sm font-semibold text-text-warm truncate">{team.name}</span>
                      <span className="badge badge-muted text-[9px]">{team.totalPoints} pts</span>
                    </button>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button className="btn btn-ghost !px-2.5 !py-1.5 text-[11px]" onClick={() => onEditTeam(team)}>
                        <Edit2 size={12} /> Editar
                      </button>
                      <DeleteConfirmButton team={team} deleting={deletingId === team.id} onConfirm={() => void handleDelete(team)} />
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t px-3 py-3 space-y-2 animate-fade-in" style={{ borderColor: "rgb(var(--border-subtle))" }}>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div><p className="text-[9px] text-text-muted uppercase tracking-wide">Grupos</p><p className="text-sm font-bold text-text-warm">{team.groupPoints}</p></div>
                        <div><p className="text-[9px] text-text-muted uppercase tracking-wide">Elim.</p><p className="text-sm font-bold text-text-warm">{team.finalPhasePoints}</p></div>
                        <div><p className="text-[9px] text-text-muted uppercase tracking-wide">Especiales</p><p className="text-sm font-bold text-text-warm">{team.specialPoints}</p></div>
                      </div>
                      {team.createdAt && (
                        <p className="text-[10px] text-text-muted">
                          Creada: {new Date(team.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB: PROGRESO — completitud de cada porra (Task 3)
// ════════════════════════════════════════════════════════════

type ProgressSort = "progress-asc" | "progress-desc" | "name";

function progressColor(percent: number): string {
  if (percent >= 100) return "rgb(var(--success))";
  if (percent >= 67) return "rgb(var(--success))";
  if (percent >= 34) return "rgb(var(--amber))";
  return "rgb(var(--danger))";
}

function ProgressBar({ percent }: { percent: number }) {
  const color = progressColor(percent);
  return (
    <div
      className="relative h-2.5 w-full overflow-hidden rounded-full"
      style={{ background: "rgb(var(--bg-muted))" }}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${percent}%`, background: color }}
      />
    </div>
  );
}

function PorrasProgressSection({ participants }: { participants: Team[] }) {
  const [sortBy, setSortBy] = useState<ProgressSort>("progress-asc");

  const rows = useMemo(() => {
    const computed = participants.map((team) => ({ team, c: computePorraCompleteness(team) }));
    computed.sort((a, b) => {
      if (sortBy === "name") return a.team.name.localeCompare(b.team.name, "es");
      if (sortBy === "progress-desc") {
        if (b.c.percent !== a.c.percent) return b.c.percent - a.c.percent;
        return a.team.name.localeCompare(b.team.name, "es");
      }
      // progress-asc (por defecto): las más incompletas primero
      if (a.c.percent !== b.c.percent) return a.c.percent - b.c.percent;
      return a.team.name.localeCompare(b.team.name, "es");
    });
    return computed;
  }, [participants, sortBy]);

  const completas = rows.filter((r) => r.c.percent >= 100).length;

  if (!rows.length) {
    return <div className="card text-center py-10"><p className="text-text-muted text-sm">No hay porras guardadas.</p></div>;
  }

  const sortOptions: { key: ProgressSort; label: string }[] = [
    { key: "progress-asc", label: "Menos completas" },
    { key: "progress-desc", label: "Más completas" },
    { key: "name", label: "Nombre" },
  ];

  return (
    <section className="animate-fade-in">
      <SectionTitle accent="#3F9D4E" icon={BarChart3} right={
        <span className="badge badge-muted text-[10px]">{completas}/{rows.length} completas</span>
      }>
        Estado de las porras
      </SectionTitle>

      <div className="mb-3 flex items-center gap-1.5 overflow-x-auto">
        <ArrowDownUp size={13} className="text-text-muted flex-shrink-0" />
        {sortOptions.map((opt) => (
          <button key={opt.key} type="button"
            className={`pill whitespace-nowrap ${sortBy === opt.key ? "active" : ""}`}
            onClick={() => setSortBy(opt.key)}>
            {opt.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {rows.map(({ team, c }) => (
          <div key={team.id} className="card !p-3.5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-warm">{team.name}</p>
                <p className="text-[10px] text-text-muted truncate">@{team.username}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {c.percent >= 100 && <Check size={14} className="text-success" />}
                <span className="font-display text-base font-extrabold tabular-nums" style={{ color: progressColor(c.percent) }}>
                  {c.percent}%
                </span>
              </div>
            </div>
            <ProgressBar percent={c.percent} />
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-text-muted tabular-nums">
              <span>{c.partidosDone}/{c.partidosTotal} partidos</span>
              <span className="text-text-faint">·</span>
              <span>{c.especialesDone}/{c.especialesTotal} especiales</span>
              <span className="text-text-faint">·</span>
              <span className="text-text-faint">
                {c.groupMatchesDone}/{c.groupMatchesTotal} grupos · {c.knockoutDone}/{c.knockoutTotal} fase final
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DeleteConfirmButton({ team, deleting, onConfirm }: { team: Team; deleting: boolean; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-danger font-medium">¿Eliminar?</span>
        <button className="btn btn-ghost !px-2 !py-1 text-[10px] !text-danger border-danger/20"
          onClick={() => { setConfirming(false); onConfirm(); }} disabled={deleting}>Confirmar</button>
        <button className="btn btn-ghost !px-2 !py-1 text-[10px]" onClick={() => setConfirming(false)}>Cancelar</button>
      </div>
    );
  }
  return (
    <button className="btn btn-ghost !px-2.5 !py-1.5 text-[11px]" style={{ color: "rgb(var(--danger))" }}
      onClick={() => setConfirming(true)} disabled={deleting}>
      <Trash2 size={12} />
    </button>
  );
}

function AdminMatchEditorCard({ match, result, onScoreChange, onClear }: {
  match: WorldCupMatch; result: AdminMatchResult | undefined;
  onScoreChange: (matchId: number, side: "home" | "away", value: string) => void;
  onClear: (matchId: number) => void;
}) {
  const group = match.stage === "group"
    ? Object.keys(GROUPS).find((k) => GROUPS[k].includes(match.homeTeam) && GROUPS[k].includes(match.awayTeam)) || null
    : null;
  const cityColor = getCityColor(match.hostCity);
  const status = formatMatchStatus(result);
  const hasBoth = typeof result?.home === "number" && typeof result?.away === "number";

  return (
    <article className="card admin-match-editor-card">
      <div className="mb-2 flex items-start justify-between gap-2 flex-wrap">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-mono text-text-faint">#{match.id}</span>
          {group ? <GroupBadge group={group} /> : null}
          <span className={status.className}>{status.label}</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold"
          style={{ background: getCityBgColor(match.hostCity), color: cityColor, border: `1px solid ${cityColor}33` }}>
          <MapPin size={9} /> {match.hostCity}
        </span>
      </div>
      <div className="admin-match-row">
        <div className="admin-match-team admin-match-team--home">
          <span className="admin-match-team-name">{match.homeTeam}</span>
          <Flag country={match.homeTeam} size="sm" />
        </div>
        <div className="admin-score-editor">
          <input className="admin-score-input" inputMode="numeric" type="number" min={0} step={1} placeholder="-"
            value={typeof result?.home === "number" ? result.home : ""}
            onChange={(e) => onScoreChange(match.id, "home", e.target.value)} aria-label={`Goles ${match.homeTeam}`} />
          <span className="admin-score-separator">-</span>
          <input className="admin-score-input" inputMode="numeric" type="number" min={0} step={1} placeholder="-"
            value={typeof result?.away === "number" ? result.away : ""}
            onChange={(e) => onScoreChange(match.id, "away", e.target.value)} aria-label={`Goles ${match.awayTeam}`} />
        </div>
        <div className="admin-match-team admin-match-team--away">
          <Flag country={match.awayTeam} size="sm" />
          <span className="admin-match-team-name">{match.awayTeam}</span>
        </div>
      </div>
      <div className="mt-3 admin-match-footer">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="badge badge-muted text-[10px]">{match.roundLabel}</span>
          <span className="text-[10px] text-text-muted">{hasBoth ? "Marcador listo" : "Introduce ambos goles"}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-text-muted">
            <Clock3 size={11} /> Resultado oficial
          </span>
          <button type="button" className="btn btn-ghost !px-3 !py-1.5 text-[11px]"
            onClick={() => onClear(match.id)}
            disabled={!result || (result.home === null && result.away === null)}>
            <Trash2 size={12} /> Limpiar
          </button>
        </div>
      </div>
    </article>
  );
}

// ════════════════════════════════════════════════════════════
// TAB: COPA — sorteo del Mundial entre porras (solo admin)
// ════════════════════════════════════════════════════════════
function CupAdminSection({ participants }: { participants: Team[] }) {
  const [config, setConfig] = useState<{ locked: boolean; roster?: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/cup", { cache: "no-store" });
        const data = await res.json();
        if (active) setConfig(data);
      } catch {
        /* noop */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/cup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      setConfig(data);
      setMsg("Hecho.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se ha podido completar la acción.");
    } finally {
      setBusy(false);
    }
  };

  const locked = Boolean(config?.locked);
  const rosterCount = config?.roster?.length ?? 0;

  return (
    <section className="animate-fade-in">
      <SectionTitle accent="#C99625" icon={Crown}>Copa · Mundial entre porras</SectionTitle>
      <div className="card space-y-3 p-4">
        {locked ? (
          <>
            <p className="text-sm text-text-warm">
              Sorteo hecho con <b>{rosterCount}</b> porras.
            </p>
            <p className="text-[12px] text-text-muted">
              Las porras creadas después del sorteo no entran en la Copa (siguen en el ranking general).
            </p>
            <button disabled={busy} onClick={() => void post({ action: "reset" })} className="btn btn-ghost !py-2 text-sm">
              Deshacer sorteo
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-text-warm">
              Genera el sorteo con las {participants.length} porras actuales. Una vez hecho, queda congelado.
            </p>
            <button
              disabled={busy}
              onClick={() => void post({ action: "draw", roster: participants.map((p) => p.id) })}
              className="btn btn-primary !py-2 text-sm"
            >
              Generar sorteo
            </button>
          </>
        )}
        {msg && <p className="text-[12px] text-text-muted">{msg}</p>}
      </div>
    </section>
  );
}
