"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Crown, Trophy, X } from "lucide-react";
import { FIXTURES, GROUP_COLORS, type Team } from "@/lib/data";
import { EmptyState, Flag, InitialsAvatar, PickChip, Skeleton } from "@/components/ui";
import { scoreMatchPickAgainstAdmin, type MatchPickPointStatus } from "@/lib/scoring";
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

function formatScorePick(pick: { home: number | null; away: number | null } | null | undefined): string {
  if (!pick || typeof pick.home !== "number" || typeof pick.away !== "number") return "—";
  return `${pick.home} - ${pick.away}`;
}

export default function CopaPage() {
  const { locked, groups, bracket, goals, teamById, adminResults, liveMatchCount, isLoading } = useCup();
  const [tab, setTab] = useState<TabKey>("grupos");
  const [jornada, setJornada] = useState<Ventana>("J1");
  const [detail, setDetail] = useState<{ homeId?: string; awayId?: string; ventana: Ventana } | null>(null);

  const name = (id?: string) => (id ? teamById.get(id)?.name ?? "—" : "—");
  const avatar = (id?: string) => (id ? teamById.get(id)?.avatarUrl ?? null : null);

  function TeamCell({ id, size = 24 }: { id?: string; size?: number }) {
    return (
      <span className="inline-flex items-center gap-2 min-w-0">
        <InitialsAvatar name={name(id)} size={size} avatarUrl={avatar(id)} />
        <span className="truncate text-sm">{name(id)}</span>
      </span>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4">
      <header className="mb-4 flex items-center gap-2">
        <Crown size={22} className="text-gold" />
        <h1 className="font-display text-xl font-bold text-text-warm">Copa · Mundial entre porras</h1>
        {liveMatchCount > 0 && (
          <span
            className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
            style={{ background: "rgba(var(--danger), 0.12)", color: "rgb(var(--danger))" }}
          >
            ● En vivo
          </span>
        )}
      </header>

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
          <div className="mb-4 flex gap-1 rounded-xl bg-bg-2 p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  tab === t.key ? "bg-bg-1 text-text-warm shadow-sm" : "text-text-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Grupos ── */}
          {tab === "grupos" && groups && (
            <div className="space-y-4">
              {GROUP_LABELS.map((label) => {
                const rows = groups.standings[label] || [];
                const color = groupColor(label);
                return (
                  <div key={label} className="card overflow-hidden p-0">
                    <div className="flex items-center gap-2 px-3 py-2" style={{ background: `${color}1F`, borderBottom: `1px solid ${color}38` }}>
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: color, color: "#fff" }}>
                        {label}
                      </span>
                      <span className="text-sm font-bold" style={{ color }}>Grupo {label}</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] uppercase text-text-muted">
                          <th className="px-2 py-1 text-left font-medium">#</th>
                          <th className="px-2 py-1 text-left font-medium">Porra</th>
                          <th className="px-1 py-1 text-center font-medium">PJ</th>
                          <th className="px-1 py-1 text-center font-medium">GF</th>
                          <th className="px-1 py-1 text-center font-medium">GC</th>
                          <th className="px-1 py-1 text-center font-medium">DG</th>
                          <th className="px-2 py-1 text-center font-medium">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={r.teamId} className="border-t border-border-subtle">
                            <td className="px-2 py-1.5 text-text-muted">{i + 1}</td>
                            <td className="px-2 py-1.5"><TeamCell id={r.teamId} /></td>
                            <td className="px-1 py-1.5 text-center text-text-muted">{r.pj}</td>
                            <td className="px-1 py-1.5 text-center">{r.gf}</td>
                            <td className="px-1 py-1.5 text-center">{r.gc}</td>
                            <td className="px-1 py-1.5 text-center">{r.dg > 0 ? `+${r.dg}` : r.dg}</td>
                            <td className="px-2 py-1.5 text-center font-bold">{r.pts}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
              <p className="px-1 text-[11px] text-text-muted">
                Goles a favor = puntos de la porra en esas jornadas. Clasifican los 2 primeros de cada grupo y los 4 mejores terceros.
              </p>
            </div>
          )}

          {/* ── Calendario ── */}
          {tab === "calendario" && groups && (
            <div>
              <div className="mb-3 flex gap-1 rounded-xl bg-bg-2 p-1">
                {JORNADAS.map((j) => (
                  <button
                    key={j.key}
                    type="button"
                    onClick={() => setJornada(j.key)}
                    className={`flex-1 rounded-lg px-2 py-1 text-xs font-semibold transition ${
                      jornada === j.key ? "bg-bg-1 text-text-warm shadow-sm" : "text-text-muted"
                    }`}
                  >
                    {j.label}
                  </button>
                ))}
              </div>
              <p className="mb-2 px-1 text-[11px] text-text-muted">Toca un cruce para ver lo que puso cada porra en esa jornada.</p>
              <div className="space-y-2">
                {GROUP_LABELS.flatMap((label) =>
                  (groups.fixtures[label] || [])
                    .filter((fx) => fx.ventana === jornada)
                    .map((fx, idx) => (
                      <button
                        key={`${label}-${jornada}-${idx}`}
                        type="button"
                        onClick={() => setDetail({ homeId: fx.homeId, awayId: fx.awayId, ventana: fx.ventana })}
                        className="card flex w-full items-center gap-2 px-3 py-2 text-left"
                      >
                        <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: `${groupColor(label)}1F`, color: groupColor(label) }}>
                          {label}
                        </span>
                        <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
                          <span className="truncate text-sm">{name(fx.homeId)}</span>
                          <InitialsAvatar name={name(fx.homeId)} size={22} avatarUrl={avatar(fx.homeId)} />
                        </div>
                        <span className="flex-shrink-0 rounded-md bg-bg-2 px-2 py-0.5 text-sm font-bold tabular-nums">
                          {fx.homeGoals === null ? "·" : fx.homeGoals} - {fx.awayGoals === null ? "·" : fx.awayGoals}
                        </span>
                        <div className="flex flex-1 items-center gap-2 min-w-0">
                          <InitialsAvatar name={name(fx.awayId)} size={22} avatarUrl={avatar(fx.awayId)} />
                          <span className="truncate text-sm">{name(fx.awayId)}</span>
                        </div>
                      </button>
                    ))
                )}
              </div>
            </div>
          )}

          {/* ── Cuadro ── */}
          {tab === "cuadro" && bracket && (
            <div className="overflow-x-auto pb-2">
              <div className="flex gap-3" style={{ minWidth: 760 }}>
                {(
                  [
                    { label: "Dieciseisavos", matches: bracket.r32 },
                    { label: "Octavos", matches: bracket.r16 },
                    { label: "Cuartos", matches: bracket.qf },
                    { label: "Semifinales", matches: bracket.sf },
                    { label: "Final", matches: [bracket.final] },
                    { label: "3.er puesto", matches: [bracket.third] },
                  ] as { label: string; matches: BracketMatch[] }[]
                ).map((col) => (
                  <div key={col.label} className="flex-1" style={{ minWidth: 150 }}>
                    <p className="mb-2 text-center text-[11px] font-semibold uppercase text-text-muted">{col.label}</p>
                    <div className="space-y-2">
                      {col.matches.map((m) => (
                        <BracketCard key={m.id} m={m} name={name} avatar={avatar} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
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
}: {
  m: BracketMatch;
  name: (id?: string) => string;
  avatar: (id?: string) => string | null;
}) {
  const Side = ({ id, slot, goals }: { id?: string; slot: string; goals?: number | null }) => {
    const isWinner = Boolean(m.winnerId) && m.winnerId === id;
    return (
      <div className={`flex items-center gap-1.5 ${isWinner ? "font-bold text-gold" : ""}`}>
        {id ? <InitialsAvatar name={name(id)} size={18} avatarUrl={avatar(id)} /> : null}
        <span className="flex-1 truncate text-xs">{id ? name(id) : (m.ronda === "R32" ? refLabel(slot) : "Por definir")}</span>
        <span className="text-xs tabular-nums">{goals === null || goals === undefined ? "" : goals}</span>
      </div>
    );
  };
  return (
    <div className="card space-y-1 px-2 py-1.5">
      <Side id={m.homeId} slot={m.homeRef} goals={m.homeGoals} />
      <div className="h-px bg-border-subtle" />
      <Side id={m.awayId} slot={m.awayRef} goals={m.awayGoals} />
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
  onClose,
}: {
  homeId?: string;
  awayId?: string;
  ventana: Ventana;
  goals: GoalsMap;
  adminResults: AdminResults;
  teamById: Map<string, Team>;
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

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center overflow-y-auto"
      style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl p-4"
        style={{ background: "rgb(var(--bg-1))", maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-text-warm">Jornada {n}</h3>
          <button type="button" onClick={onClose} className="rounded-lg bg-bg-2 p-1.5 text-text-muted" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        {/* Marcador del cruce */}
        <div className="mb-4 flex items-center justify-center gap-3 rounded-xl bg-bg-2 px-3 py-3">
          <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
            <span className="truncate text-sm font-semibold">{home?.name ?? "—"}</span>
            <InitialsAvatar name={home?.name ?? "—"} size={28} avatarUrl={home?.avatarUrl ?? null} />
          </div>
          <span className="flex-shrink-0 text-lg font-black tabular-nums">{hg} - {ag}</span>
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <InitialsAvatar name={away?.name ?? "—"} size={28} avatarUrl={away?.avatarUrl ?? null} />
            <span className="truncate text-sm font-semibold">{away?.name ?? "—"}</span>
          </div>
        </div>

        {/* Por partido: pronóstico de cada porra */}
        <div className="space-y-2">
          {matches.map((f) => {
            const ph = pickFor(home, f.id, f.group);
            const pa = pickFor(away, f.id, f.group);
            return (
              <div key={f.id} className="rounded-xl border border-border-subtle px-2 py-2">
                <div className="mb-1.5 flex items-center justify-center gap-1.5 text-[11px] text-text-muted">
                  <Flag country={f.homeTeam} size="sm" />
                  <span className="font-semibold">{f.homeTeam}</span>
                  <span>·</span>
                  <span className="font-semibold">{f.awayTeam}</span>
                  <Flag country={f.awayTeam} size="sm" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 items-center justify-end gap-1.5 min-w-0">
                    <PickChip status={ph.status} points={ph.points} />
                    <span className="text-sm font-bold tabular-nums">{formatScorePick(ph.pick)}</span>
                  </div>
                  <span className="flex-shrink-0 text-[10px] text-text-muted">vs</span>
                  <div className="flex flex-1 items-center gap-1.5 min-w-0">
                    <span className="text-sm font-bold tabular-nums">{formatScorePick(pa.pick)}</span>
                    <PickChip status={pa.status} points={pa.points} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
