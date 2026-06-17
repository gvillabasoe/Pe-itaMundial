"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { X } from "lucide-react";
import { CountryWithFlag, Flag, InitialsAvatar, PickChip } from "@/components/ui";
import { FIXTURES, GROUPS, GROUP_COLORS, type Team } from "@/lib/data";
import { useAuth } from "@/components/auth-provider";
import { useScoredParticipants } from "@/lib/use-scored-participants";
import {
  FINISHED_STATUSES,
  IN_PLAY_STATUSES,
  buildResultsByMatchId,
  sanitizeFixtures,
} from "@/lib/admin-import-fixtures";
import { computeGroupTable, type GroupMatchScore, type GroupTableRow } from "@/lib/worldcup/group-tables";
import { WORLD_CUP_MATCHES } from "@/lib/worldcup/schedule";
import { getGroupMatchResult, scoreMatchPickAgainstAdmin, type MatchPickPointStatus } from "@/lib/scoring";
import type { AdminResults } from "@/lib/admin-results";

// ════════════════════════════════════════════════════════════
// Tablas de grupo EN VIVO (criterios FIFA), todos los grupos seguidos.
// Puestos coloreados como en la Copa (1-2 verde, 3 ámbar, 4 rojo). Al tocar
// una selección se ven sus partidos, el resultado y los puntos que has
// obtenido. Incluye la tabla de mejores terceros (8 mejores en verde).
// ════════════════════════════════════════════════════════════

interface FixturesPayload {
  connection?: string;
  fixtures?: unknown;
}

const fetcher = async (url: string): Promise<FixturesPayload> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("No se han podido cargar los partidos.");
  return res.json();
};

const MATCH_BY_ID = new Map(WORLD_CUP_MATCHES.map((m) => [String(m.id), m]));
const LIVE_AND_DONE = new Set<string>([...FINISHED_STATUSES, ...IN_PLAY_STATUSES]);

const QUALIFY = "rgb(var(--accent-participante))";
const AMBER = "rgb(var(--amber))";
const DANGER = "rgb(var(--danger))";
const QUALIFY_BG = "rgba(63,157,78,0.06)";

function groupColor(label: string): string {
  return GROUP_COLORS[label] || "#7A7A7A";
}

function groupStatusColor(idx: number, size: number): string {
  if (idx < 2) return QUALIFY;
  if (idx === 2) return size >= 4 ? AMBER : DANGER;
  return DANGER;
}

export function LiveGroupTables() {
  const { user } = useAuth();
  const { participants, adminResults } = useScoredParticipants();
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  const { data } = useSWR<FixturesPayload>("/api/results/fixtures", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    dedupingInterval: 15_000,
  });

  const { scores, liveGroups } = useMemo(() => {
    const fixtures = sanitizeFixtures(data?.fixtures);
    const byId = buildResultsByMatchId(fixtures, LIVE_AND_DONE);
    const list: GroupMatchScore[] = [];
    byId.forEach((score, matchId) => {
      const match = MATCH_BY_ID.get(matchId);
      if (!match || match.stage !== "group") return;
      list.push({ matchId: Number(matchId), homeTeam: match.homeTeam, awayTeam: match.awayTeam, home: score.home, away: score.away });
    });
    const live = new Set<string>();
    for (const f of fixtures.filter((x) => IN_PLAY_STATUSES.has(x.statusShort))) {
      for (const [letter, teams] of Object.entries(GROUPS)) {
        if (teams.includes(f.homeTeam) || teams.includes(f.awayTeam)) live.add(letter);
      }
    }
    return { scores: list, liveGroups: live };
  }, [data]);

  const tables = useMemo(() => {
    const out: Record<string, GroupTableRow[]> = {};
    for (const letter of Object.keys(GROUPS)) out[letter] = computeGroupTable(letter, scores);
    return out;
  }, [scores]);

  // Mejores terceros: el 3.º de cada grupo, ordenados (puntos, DG, GF). Top 8 pasan.
  const thirds = useMemo(() => {
    const rows = Object.entries(tables)
      .map(([letter, table]) => (table[2] ? { letter, row: table[2] } : null))
      .filter((x): x is { letter: string; row: GroupTableRow } => Boolean(x));
    rows.sort(
      (a, b) =>
        b.row.points - a.row.points ||
        b.row.goalDiff - a.row.goalDiff ||
        b.row.goalsFor - a.row.goalsFor ||
        a.row.team.localeCompare(b.row.team, "es")
    );
    return rows;
  }, [tables]);

  const anyPlayed = scores.length > 0;

  return (
    <div className="space-y-3">
      {liveGroups.size > 0 && (
        <div className="card !py-2 !px-3 flex items-center gap-2 animate-fade-in" style={{ borderColor: "rgb(var(--danger) / 0.3)", background: "rgb(var(--danger) / 0.06)" }}>
          <span className="animate-pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: DANGER, flexShrink: 0 }} />
          <span className="text-[12px] font-semibold text-text-warm">Clasificación en vivo</span>
          <span className="text-[11px] text-text-muted">· partidos en juego</span>
        </div>
      )}
      {Object.keys(GROUPS).map((letter) => {
        const table = tables[letter];
        const color = groupColor(letter);
        return (
          <div key={letter} className="card !p-0 overflow-hidden animate-fade-in">
            <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ background: `${color}1A`, borderBottom: `1px solid ${color}33` }}>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black" style={{ background: color, color: "#fff" }}>
                {letter}
              </span>
              <span className="font-display text-sm font-bold" style={{ color, flex: 1 }}>Grupo {letter}</span>
              {liveGroups.has(letter) && (
                <span className="animate-pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: DANGER }} />
              )}
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
                  <th className="py-1.5 pl-1 text-left font-semibold">Equipo</th>
                  <th className="py-1.5 text-center font-semibold">PJ</th>
                  <th className="py-1.5 text-center font-semibold">GF</th>
                  <th className="py-1.5 text-center font-semibold">GC</th>
                  <th className="py-1.5 text-center font-semibold">DG</th>
                  <th className="py-1.5 text-center font-semibold">PTS</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row, idx) => {
                  const sc = groupStatusColor(idx, table.length);
                  return (
                    <tr
                      key={row.team}
                      className="border-t border-border-subtle cursor-pointer"
                      onClick={() => setSelectedTeam(row.team)}
                      style={{ background: idx < 2 ? QUALIFY_BG : undefined }}
                    >
                      <td className="py-2 text-center" style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 3, borderRadius: 2, background: sc }} />
                        <span className="text-sm font-bold" style={{ color: sc }}>{idx + 1}{row.positionUndecided ? "*" : ""}</span>
                      </td>
                      <td className="py-2 pl-1 overflow-hidden">
                        <CountryWithFlag country={row.team} size="sm" textClassName="text-[12px] text-text-primary truncate" />
                      </td>
                      <td className="py-2 text-center text-sm text-text-muted tabular-nums">{row.played}</td>
                      <td className="py-2 text-center text-sm tabular-nums">{row.goalsFor}</td>
                      <td className="py-2 text-center text-sm tabular-nums">{row.goalsAgainst}</td>
                      <td className="py-2 text-center text-sm tabular-nums">{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                      <td className="py-2 text-center text-sm font-black text-text-warm tabular-nums">{row.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Mejores terceros */}
      <div className="card !p-0 overflow-hidden animate-fade-in">
        <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ background: QUALIFY_BG, borderBottom: "1px solid rgb(var(--border-subtle))" }}>
          <span className="font-display text-sm font-bold" style={{ color: QUALIFY }}>Mejores terceros</span>
          <span className="text-[10px] text-text-muted" style={{ flex: 1 }}>· los 8 mejores pasan</span>
        </div>
        <table className="w-full" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 30 }} />
            <col />
            <col style={{ width: 38 }} />
            <col style={{ width: 32 }} />
            <col style={{ width: 40 }} />
            <col style={{ width: 42 }} />
          </colgroup>
          <thead>
            <tr className="text-[9px] uppercase tracking-wide text-text-faint">
              <th className="py-1.5 text-center font-semibold">#</th>
              <th className="py-1.5 pl-1 text-left font-semibold">Equipo</th>
              <th className="py-1.5 text-center font-semibold">Gr.</th>
              <th className="py-1.5 text-center font-semibold">PJ</th>
              <th className="py-1.5 text-center font-semibold">DG</th>
              <th className="py-1.5 text-center font-semibold">PTS</th>
            </tr>
          </thead>
          <tbody>
            {thirds.map(({ letter, row }, idx) => {
              const sc = idx < 8 ? QUALIFY : DANGER;
              return (
                <tr
                  key={row.team}
                  className="border-t border-border-subtle cursor-pointer"
                  onClick={() => setSelectedTeam(row.team)}
                  style={{ background: idx < 8 ? QUALIFY_BG : undefined }}
                >
                  <td className="py-2 text-center" style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 3, borderRadius: 2, background: sc }} />
                    <span className="text-sm font-bold" style={{ color: sc }}>{idx + 1}</span>
                  </td>
                  <td className="py-2 pl-1 overflow-hidden">
                    <CountryWithFlag country={row.team} size="sm" textClassName="text-[12px] text-text-primary truncate" />
                  </td>
                  <td className="py-2 text-center text-[11px] font-bold text-text-muted">{letter}</td>
                  <td className="py-2 text-center text-sm text-text-muted tabular-nums">{row.played}</td>
                  <td className="py-2 text-center text-sm tabular-nums">{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                  <td className="py-2 text-center text-sm font-black text-text-warm tabular-nums">{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="px-1 text-[11px] text-text-muted">
        Orden por criterios FIFA (puntos, diferencia de goles, goles a favor). Toca una selección para ver sus partidos y tus puntos.
        {anyPlayed ? "" : " Se rellenará al disputarse los partidos."}
      </p>

      {selectedTeam && (
        <TeamMatchesDetail
          country={selectedTeam}
          participants={participants}
          adminResults={adminResults}
          user={user}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </div>
  );
}

function TeamMatchesDetail({
  country,
  participants,
  adminResults,
  user,
  onClose,
}: {
  country: string;
  participants: Team[];
  adminResults: AdminResults;
  user: { id: string; username: string } | null;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;

  const order: Record<string, number> = { "Jornada 1": 1, "Jornada 2": 2, "Jornada 3": 3 };
  const matches = FIXTURES.filter((f) => f.stage === "groups" && (f.homeTeam === country || f.awayTeam === country)).sort(
    (a, b) => (order[a.round] ?? 9) - (order[b.round] ?? 9)
  );
  const myPorras = participants.filter((p) => user && (p.userId === user.id || p.username === user.username));

  const pickFor = (team: Team, f: (typeof matches)[number]) => {
    const pick = team.matchPicks?.[f.id];
    const isDouble = Boolean(f.group && team.doubleMatches?.[f.group] === f.id);
    const scored = scoreMatchPickAgainstAdmin(
      f.id,
      pick as { home: number | null; away: number | null } | undefined,
      isDouble,
      adminResults
    );
    return { pick, points: scored.points, status: scored.status as MatchPickPointStatus };
  };

  const totalFor = (team: Team) =>
    matches.reduce((acc, f) => acc + (pickFor(team, f).points ?? 0), 0);

  const fmt = (p: { home: number | null; away: number | null } | null | undefined) =>
    p && typeof p.home === "number" && typeof p.away === "number" ? `${p.home} - ${p.away}` : "—";

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center" style={{ background: "rgba(10,12,20,0.55)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="rounded-t-3xl w-full max-w-[640px] max-h-[88vh] overflow-y-auto p-5 animate-slide-up bg-bg-1" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Flag country={country} size="md" />
            <p className="font-display text-lg font-black text-text-warm truncate">{country}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-bg-2 p-1.5 text-text-muted flex-shrink-0" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        {myPorras.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {myPorras.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: QUALIFY_BG, color: QUALIFY }}>
                <InitialsAvatar name={p.name} size={16} avatarUrl={p.avatarUrl ?? null} />
                {p.name}: {totalFor(p)} pts
              </span>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {matches.map((f) => {
            const flipped = f.awayTeam === country; // ponemos a "country" a la izquierda
            const left = flipped ? f.awayTeam : f.homeTeam;
            const right = flipped ? f.homeTeam : f.awayTeam;
            const real = getGroupMatchResult(f.id, adminResults);
            const realStr = real
              ? flipped
                ? `${real.away} - ${real.home}`
                : `${real.home} - ${real.away}`
              : "·";
            return (
              <div key={f.id} className="card !py-2.5 !px-3">
                <div className="mb-1 flex items-center justify-center gap-2 text-[12px]">
                  <span className="truncate font-semibold text-text-primary">{left}</span>
                  <Flag country={left} size="sm" />
                  <span className="font-display rounded-lg bg-bg-2 px-2 py-0.5 text-sm font-black tabular-nums text-text-warm">{realStr}</span>
                  <Flag country={right} size="sm" />
                  <span className="truncate font-semibold text-text-primary">{right}</span>
                </div>
                {myPorras.length === 0 ? (
                  <p className="text-center text-[10px] text-text-faint">{f.round}</p>
                ) : (
                  <div className="mt-1.5 space-y-1">
                    {myPorras.map((p) => {
                      const r = pickFor(p, f);
                      const pickStr = flipped && r.pick && typeof r.pick.home === "number" && typeof r.pick.away === "number"
                        ? `${r.pick.away} - ${r.pick.home}`
                        : fmt(r.pick);
                      return (
                        <div key={p.id} className="flex items-center gap-2">
                          <span className="flex-1 truncate text-[12px] text-text-muted">{p.name}</span>
                          <span className="font-display text-[13px] font-bold tabular-nums">{pickStr}</span>
                          <PickChip status={r.status} points={r.points} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
