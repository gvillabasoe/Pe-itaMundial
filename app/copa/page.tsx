"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Crown, Trophy, X } from "lucide-react";
import { FIXTURES, GROUP_COLORS, type Team } from "@/lib/data";
import { useAuth } from "@/components/auth-provider";
import { EmptyState, Flag, InitialsAvatar, PickChip, Skeleton } from "@/components/ui";
import { scoreGroupPositionPoints, scoreMatchPickAgainstAdmin, type MatchPickPointStatus } from "@/lib/scoring";
import type { AdminResults } from "@/lib/admin-results";
import { GROUP_LABELS } from "@/lib/cup/template";
import { useCup } from "@/lib/cup/use-cup";
import type { BracketMatch } from "@/lib/cup/types";
import type { Ventana } from "@/lib/scoring";
import type { GoalsMap } from "@/lib/cup/groups";

const EXTRA_GROUP_COLORS: Record<string, string> = { M: "#3F7D6B", N: "#9C5B8B" };
function groupColor(label: string): string {
  return GROUP_COLORS[label] || EXTRA_GROUP_COLORS[label] || "#7A7A7A";
}

const ACCENT = "rgb(var(--accent-participante))";
const ACCENT_BG = "rgba(63,157,78,0.06)";

function MineTag() {
  return (
    <span
      className="flex-shrink-0 rounded px-1 py-px text-[8px] font-black uppercase leading-none"
      style={{ background: "rgba(63,157,78,0.16)", color: ACCENT }}
    >
      Tú
    </span>
  );
}

const TABS = [
  { key: "grupos", label: "Grupos" },
  { key: "calendario", label: "Calendario" },
  { key: "cuadro", label: "Cuadro" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const JORNADAS: { key: Ventana; label: string }[] = [
  { key: "J1", label: "Jornada 1" },
  { key: "J2", label: "Jornada 2" },
  { key: "J3", label: "Jornada 3" },
];

function jornadaNumber(v: Ventana): number {
  return v === "J1" ? 1 : v === "J2" ? 2 : 3;
}

const CUP_COL_W = 184;
const CUP_CONN_W = 20;

function formatScorePick(pick: { home: number | null; away: number | null } | null | undefined): string {
  if (!pick || typeof pick.home !== "number" || typeof pick.away !== "number") return "—";
  return `${pick.home} - ${pick.away}`;
}

export default function CopaPage() {
  const { locked, groups, bracket, goals, teamById, adminResults, liveMatchCount, isLoading } = useCup();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>("grupos");
  const [jornada, setJornada] = useState<Ventana>("J1");
  const [detail, setDetail] = useState<{ homeId?: string; awayId?: string; ventana: Ventana } | null>(null);

  const name = (id?: string) => (id ? teamById.get(id)?.name ?? "—" : "—");
  const avatar = (id?: string) => (id ? teamById.get(id)?.avatarUrl ?? null : null);
  const isMine = (id?: string) => {
    if (!id || !user) return false;
    const t = teamById.get(id);
    return Boolean(t && (t.userId === user.id || t.username === user.username));
  };

  function TeamCell({ id, size = 24 }: { id?: string; size?: number }) {
    const mine = isMine(id);
    return (
      <span className="flex items-center gap-2 min-w-0">
        <span className="flex-shrink-0">
          <InitialsAvatar name={name(id)} size={size} avatarUrl={avatar(id)} />
        </span>
        <span className={`truncate text-sm min-w-0 ${mine ? "font-bold" : ""}`} style={mine ? { color: ACCENT } : undefined}>
          {name(id)}
        </span>
        {mine && <MineTag />}
      </span>
    );
  }

  return (
    <div className="px-4 pt-5 max-w-[640px] mx-auto pb-24">
      <div className="page-header animate-fade-in">
        <div>
          <h1 className="page-header__title">Copa</h1>
          <p className="text-[12px] text-text-muted">Mundial entre porras</p>
        </div>
        {liveMatchCount > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase"
            style={{ background: "rgba(var(--danger), 0.12)", color: "rgb(var(--danger))" }}
          >
            ● En vivo
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !locked ? (
        <EmptyState
          icon={Trophy}
          title="La Copa aún no ha empezado"
          text="El organizador todavía no ha hecho el sorteo de grupos."
        />
      ) : (
        <>
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.key} className={`pill whitespace-nowrap ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Grupos ── */}
          {tab === "grupos" && groups && (
            <div className="space-y-3">
              {GROUP_LABELS.map((label) => {
                const rows = groups.standings[label] || [];
                const color = groupColor(label);
                const size = rows.length;
                // Estado por puesto: 1-2 clasifican (verde), 3 mejor tercero
                // (ámbar, depende de otros grupos) salvo grupo de 3 (rojo), 4 eliminado (rojo).
                const statusColor = (idx: number): string | null => {
                  if (idx < 2) return "rgb(var(--accent-participante))";
                  if (idx === 2) return size >= 4 ? "rgb(var(--amber))" : "rgb(var(--danger))";
                  return "rgb(var(--danger))";
                };
                return (
                  <div key={label} className="card !p-0 overflow-hidden animate-fade-in">
                    <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ background: `${color}1A`, borderBottom: `1px solid ${color}33` }}>
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black" style={{ background: color, color: "#fff" }}>
                        {label}
                      </span>
                      <span className="font-display text-sm font-bold" style={{ color }}>Grupo {label}</span>
                    </div>
                    <table className="w-full" style={{ tableLayout: "fixed" }}>
                      <colgroup>
                        <col style={{ width: 30 }} />
                        <col />
                        <col style={{ width: 32 }} />
                        <col style={{ width: 34 }} />
                        <col style={{ width: 34 }} />
                        <col style={{ width: 38 }} />
                        <col style={{ width: 42 }} />
                      </colgroup>
                      <thead>
                        <tr className="text-[9px] uppercase tracking-wide text-text-faint">
                          <th className="py-1.5 text-center font-semibold">#</th>
                          <th className="py-1.5 pl-1 text-left font-semibold">Porra</th>
                          <th className="py-1.5 text-center font-semibold">PJ</th>
                          <th className="py-1.5 text-center font-semibold">GF</th>
                          <th className="py-1.5 text-center font-semibold">GC</th>
                          <th className="py-1.5 text-center font-semibold">DG</th>
                          <th className="py-1.5 text-center font-semibold">PTS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => {
                          const mine = isMine(r.teamId);
                          const sc = statusColor(i);
                          return (
                            <tr
                              key={r.teamId}
                              className="border-t border-border-subtle"
                              style={{ background: mine ? ACCENT_BG : undefined }}
                            >
                              <td className="py-2 text-center" style={{ position: "relative" }}>
                                {sc && <span style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 3, borderRadius: 2, background: sc }} />}
                                <span className="text-sm font-bold" style={{ color: sc ?? undefined }}>{i + 1}</span>
                              </td>
                              <td className="py-2 pl-1 overflow-hidden"><TeamCell id={r.teamId} size={24} /></td>
                              <td className="py-2 text-center text-sm text-text-muted">{r.pj}</td>
                              <td className="py-2 text-center text-sm">{r.gf}</td>
                              <td className="py-2 text-center text-sm">{r.gc}</td>
                              <td className="py-2 text-center text-sm">{r.dg > 0 ? `+${r.dg}` : r.dg}</td>
                              <td className="py-2 text-center text-sm font-black text-text-warm">{r.pts}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
              <div className="px-1 text-[11px] text-text-muted space-y-1">
                <p>Goles a favor = puntos de la porra en esas jornadas.</p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 2, background: "rgb(var(--accent-participante))" }} /> Clasifican</span>
                  <span className="inline-flex items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 2, background: "rgb(var(--amber))" }} /> Mejor tercero</span>
                  <span className="inline-flex items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 2, background: "rgb(var(--danger))" }} /> Eliminado</span>
                </p>
              </div>
            </div>
          )}

          {/* ── Calendario ── */}
          {tab === "calendario" && groups && (
            <div>
              <div className="flex gap-2 mb-3 overflow-x-auto">
                {JORNADAS.map((j) => (
                  <button key={j.key} className={`pill whitespace-nowrap ${jornada === j.key ? "active" : ""}`} onClick={() => setJornada(j.key)}>
                    {j.label}
                  </button>
                ))}
              </div>
              <p className="mb-2 px-1 text-[11px] text-text-muted">Toca un cruce para ver lo que puso cada porra en esa jornada.</p>
              <div className="space-y-2">
                {GROUP_LABELS.flatMap((label) =>
                  (groups.fixtures[label] || [])
                    .filter((fx) => fx.ventana === jornada)
                    .map((fx, idx) => {
                      const mine = isMine(fx.homeId) || isMine(fx.awayId);
                      return (
                        <button
                          key={`${label}-${jornada}-${idx}`}
                          type="button"
                          onClick={() => setDetail({ homeId: fx.homeId, awayId: fx.awayId, ventana: fx.ventana })}
                          className="card flex w-full items-center gap-2 !py-2.5 !px-3 text-left animate-fade-in"
                          style={{ borderLeft: mine ? `3px solid ${ACCENT}` : undefined, background: mine ? ACCENT_BG : undefined }}
                        >
                          <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: `${groupColor(label)}1F`, color: groupColor(label) }}>
                            {label}
                          </span>
                          <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
                            <span className={`truncate text-sm min-w-0 ${isMine(fx.homeId) ? "font-bold" : ""}`} style={isMine(fx.homeId) ? { color: ACCENT } : undefined}>{name(fx.homeId)}</span>
                            {isMine(fx.homeId) && <MineTag />}
                            <InitialsAvatar name={name(fx.homeId)} size={22} avatarUrl={avatar(fx.homeId)} />
                          </div>
                          <span className="flex-shrink-0 font-display rounded-lg bg-bg-2 px-2.5 py-1 text-sm font-bold tabular-nums">
                            {fx.homeGoals === null ? "·" : fx.homeGoals} - {fx.awayGoals === null ? "·" : fx.awayGoals}
                          </span>
                          <div className="flex flex-1 items-center gap-2 min-w-0">
                            <InitialsAvatar name={name(fx.awayId)} size={22} avatarUrl={avatar(fx.awayId)} />
                            {isMine(fx.awayId) && <MineTag />}
                            <span className={`truncate text-sm min-w-0 ${isMine(fx.awayId) ? "font-bold" : ""}`} style={isMine(fx.awayId) ? { color: ACCENT } : undefined}>{name(fx.awayId)}</span>
                          </div>
                        </button>
                      );
                    })
                )}
              </div>
            </div>
          )}

          {/* ── Cuadro (estilo bracket de Resultados) ── */}
          {tab === "cuadro" && bracket && (
            <div className="card !p-3 overflow-hidden animate-fade-in">
              <div className="overflow-x-auto">
                <div style={{ display: "flex", alignItems: "stretch", minWidth: "min-content" }}>
                  {(
                    [
                      { label: "Dieciseisavos", matches: bracket.r32 },
                      { label: "Octavos", matches: bracket.r16 },
                      { label: "Cuartos", matches: bracket.qf },
                      { label: "Semifinal", matches: bracket.sf },
                      { label: "Final", matches: [bracket.final], third: bracket.third },
                    ] as { label: string; matches: BracketMatch[]; third?: BracketMatch }[]
                  ).map((col, i, arr) => {
                    const next = arr[i + 1];
                    return (
                      <div key={col.label} style={{ display: "flex", alignItems: "stretch", flexShrink: 0 }}>
                        <div style={{ width: CUP_COL_W, flexShrink: 0, display: "flex", flexDirection: "column" }}>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-text-faint" style={{ padding: "0 2px 8px", textAlign: "center" }}>
                            {col.label}
                          </div>
                          {col.third ? (
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
                              {col.matches.map((m) => (
                                <BracketCard key={m.id} m={m} name={name} avatar={avatar} isMine={isMine} />
                              ))}
                              <div>
                                <p className="mb-1 text-center text-[9px] font-bold uppercase tracking-wider" style={{ color: "#CD7F32" }}>
                                  3.er puesto
                                </p>
                                <BracketCard m={col.third} name={name} avatar={avatar} isMine={isMine} />
                              </div>
                            </div>
                          ) : (
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-around", gap: 12 }}>
                              {col.matches.map((m) => (
                                <BracketCard key={m.id} m={m} name={name} avatar={avatar} isMine={isMine} />
                              ))}
                            </div>
                          )}
                        </div>
                        {next && (
                          <div style={{ width: CUP_CONN_W, flexShrink: 0, display: "flex", flexDirection: "column", paddingTop: 22 }}>
                            <CupConnectors pairCount={next.matches.length} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {!bracket.r32[0]?.homeId && (
                <p className="mt-2 px-1 text-[11px] text-text-muted">Los clasificados aparecerán al cerrarse la Jornada 3.</p>
              )}
            </div>
          )}
        </>
      )}

      {detail && (
        <CalendarDetail
          homeId={detail.homeId}
          awayId={detail.awayId}
          ventana={detail.ventana}
          goals={goals}
          adminResults={adminResults}
          teamById={teamById}
          isMine={isMine}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function refLabel(ref: string): string {
  if (ref.startsWith("T")) return `3.º (${ref.slice(1)})`;
  if (ref[0] === "1" || ref[0] === "2") return `${ref[0]}.º ${ref.slice(1)}`;
  return "Por definir";
}

function BracketCard({
  m,
  name,
  avatar,
  isMine,
}: {
  m: BracketMatch;
  name: (id?: string) => string;
  avatar: (id?: string) => string | null;
  isMine: (id?: string) => boolean;
}) {
  const containsMine = isMine(m.homeId) || isMine(m.awayId);
  const Side = ({ id, slot, goals }: { id?: string; slot: string; goals?: number | null }) => {
    const isWinner = Boolean(m.winnerId) && m.winnerId === id;
    const mine = isMine(id);
    const label = id ? name(id) : m.ronda === "R32" ? refLabel(slot) : "Por definir";
    const cls = isWinner ? "font-bold text-gold" : mine ? "font-bold" : id ? "text-text-primary" : "text-text-faint italic";
    return (
      <div className="flex items-center gap-1.5" style={{ padding: "1px 0" }}>
        {id ? (
          <InitialsAvatar name={name(id)} size={17} avatarUrl={avatar(id)} />
        ) : (
          <span style={{ width: 17, height: 17, borderRadius: "50%", background: "rgb(var(--bg-3))", flexShrink: 0 }} />
        )}
        <span className={`flex-1 truncate text-[11px] ${cls}`} style={mine && !isWinner ? { color: ACCENT } : undefined}>
          {label}
        </span>
        <span className="text-[11px] font-bold tabular-nums text-text-warm" style={{ flexShrink: 0 }}>
          {goals === null || goals === undefined ? "" : goals}
        </span>
      </div>
    );
  };
  return (
    <div
      className="rounded-xl"
      style={{
        background: containsMine ? ACCENT_BG : "rgb(var(--bg-2))",
        border: `1px solid ${containsMine ? ACCENT : "rgb(var(--border-subtle))"}`,
        padding: "6px 8px",
      }}
    >
      <Side id={m.homeId} slot={m.homeRef} goals={m.homeGoals} />
      <div style={{ height: 1, background: "rgb(var(--border-subtle))", margin: "3px 0" }} />
      <Side id={m.awayId} slot={m.awayRef} goals={m.awayGoals} />
    </div>
  );
}

function CupConnectors({ pairCount }: { pairCount: number }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-around" }}>
      {Array.from({ length: pairCount }).map((_, i) => (
        <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", position: "relative" }}>
          <div
            style={{
              width: 11,
              height: "50%",
              borderTop: "1.5px solid rgb(var(--border-default))",
              borderBottom: "1.5px solid rgb(var(--border-default))",
              borderRight: "1.5px solid rgb(var(--border-default))",
              borderTopRightRadius: 8,
              borderBottomRightRadius: 8,
            }}
          />
          <div style={{ flex: 1, height: "1.5px", background: "rgb(var(--border-default))" }} />
        </div>
      ))}
    </div>
  );
}

// ── Detalle de un cruce: lo que puso cada porra en los partidos de la jornada ──
function CalendarDetail({
  homeId,
  awayId,
  ventana,
  goals,
  adminResults,
  teamById,
  isMine,
  onClose,
}: {
  homeId?: string;
  awayId?: string;
  ventana: Ventana;
  goals: GoalsMap;
  adminResults: AdminResults;
  teamById: Map<string, Team>;
  isMine: (id?: string) => boolean;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;

  const n = jornadaNumber(ventana);
  const matches = FIXTURES.filter((f) => f.stage === "groups" && f.round === `Jornada ${n}`);
  const home = homeId ? teamById.get(homeId) : undefined;
  const away = awayId ? teamById.get(awayId) : undefined;
  const hg = homeId ? goals[homeId]?.[ventana] ?? 0 : 0;
  const ag = awayId ? goals[awayId]?.[ventana] ?? 0 : 0;

  const pickFor = (team: Team | undefined, fixtureId: string, group?: string) => {
    const pick = team?.matchPicks?.[fixtureId];
    const isDouble = Boolean(group && team?.doubleMatches?.[group] === fixtureId);
    const scored = scoreMatchPickAgainstAdmin(
      fixtureId,
      pick as { home: number | null; away: number | null } | undefined,
      isDouble,
      adminResults
    );
    return { pick, points: scored.points, status: scored.status as MatchPickPointStatus };
  };

  const mineHome = isMine(homeId);
  const mineAway = isMine(awayId);

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center" style={{ background: "rgba(10,12,20,0.55)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="rounded-t-3xl w-full max-w-[640px] max-h-[88vh] overflow-y-auto p-5 animate-slide-up bg-bg-1" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown size={18} className="text-gold" />
            <h3 className="font-display text-base font-bold text-text-warm">Jornada {n}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-bg-2 p-1.5 text-text-muted" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        {/* Marcador del cruce */}
        <div className="card !py-3 !px-3 mb-4 flex items-center justify-center gap-3">
          <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
            <span className={`truncate text-sm ${mineHome ? "font-bold" : "font-semibold"}`} style={mineHome ? { color: ACCENT } : undefined}>{home?.name ?? "—"}</span>
            <InitialsAvatar name={home?.name ?? "—"} size={30} avatarUrl={home?.avatarUrl ?? null} />
          </div>
          <span className="font-display flex-shrink-0 text-xl font-black tabular-nums text-text-warm">{hg} - {ag}</span>
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <InitialsAvatar name={away?.name ?? "—"} size={30} avatarUrl={away?.avatarUrl ?? null} />
            <span className={`truncate text-sm ${mineAway ? "font-bold" : "font-semibold"}`} style={mineAway ? { color: ACCENT } : undefined}>{away?.name ?? "—"}</span>
          </div>
        </div>

        {/* Por partido: pronóstico de cada porra */}
        <div className="space-y-2">
          {matches.map((f) => {
            const ph = pickFor(home, f.id, f.group);
            const pa = pickFor(away, f.id, f.group);
            return (
              <div key={f.id} className="card !py-2.5 !px-3">
                <div className="mb-2 flex items-center justify-center gap-2 text-[12px]">
                  <span className="font-semibold text-text-primary">{f.homeTeam}</span>
                  <Flag country={f.homeTeam} size="sm" />
                  <span className="text-text-faint">-</span>
                  <Flag country={f.awayTeam} size="sm" />
                  <span className="font-semibold text-text-primary">{f.awayTeam}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 items-center justify-end gap-1.5 min-w-0">
                    <PickChip status={ph.status} points={ph.points} />
                    <span className="font-display text-sm font-bold tabular-nums rounded-lg bg-bg-2 px-2 py-0.5">{formatScorePick(ph.pick)}</span>
                  </div>
                  <span className="flex-shrink-0 text-[10px] text-text-faint">vs</span>
                  <div className="flex flex-1 items-center gap-1.5 min-w-0">
                    <span className="font-display text-sm font-bold tabular-nums rounded-lg bg-bg-2 px-2 py-0.5">{formatScorePick(pa.pick)}</span>
                    <PickChip status={pa.status} points={pa.points} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {ventana === "J3" && (
          <div className="card !py-2.5 !px-3 mt-2">
            <div className="mb-2 text-center text-[12px] font-semibold text-text-primary">Posición de grupo</div>
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center justify-end gap-1.5">
                <span className="font-display text-sm font-bold tabular-nums rounded-lg bg-bg-2 px-2 py-0.5">
                  +{home ? scoreGroupPositionPoints(home, adminResults) : 0}
                </span>
              </div>
              <span className="flex-shrink-0 text-[10px] text-text-faint">vs</span>
              <div className="flex flex-1 items-center gap-1.5">
                <span className="font-display text-sm font-bold tabular-nums rounded-lg bg-bg-2 px-2 py-0.5">
                  +{away ? scoreGroupPositionPoints(away, adminResults) : 0}
                </span>
              </div>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-text-faint">Acierto de la posición final de cada selección en su grupo.</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
