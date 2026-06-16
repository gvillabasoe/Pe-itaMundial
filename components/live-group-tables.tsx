"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { ChevronDown, ChevronUp, Table2 } from "lucide-react";
import { CountryWithFlag, GroupBadge } from "@/components/ui";
import { GROUPS } from "@/lib/data";
import {
  FINISHED_STATUSES,
  IN_PLAY_STATUSES,
  buildResultsByMatchId,
  sanitizeFixtures,
} from "@/lib/admin-import-fixtures";
import { computeGroupTable, GROUP_MATCH_IDS, type GroupMatchScore } from "@/lib/worldcup/group-tables";
import { WORLD_CUP_MATCHES } from "@/lib/worldcup/schedule";

// ════════════════════════════════════════════════════════════
// Tablas de grupo EN VIVO, calculadas con los criterios FIFA (puntos,
// diferencia global, goles, head-to-head) a partir de los marcadores de
// la API — incluidos los partidos en juego, que se marcan con el punto
// rojo. Sección plegable; usa el mismo payload (misma key SWR) que la
// página de Resultados, así que no añade peticiones extra.
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

export function LiveGroupTables({ defaultOpen = false }: { defaultOpen?: boolean } = {}) {
  const [open, setOpen] = useState(defaultOpen);
  const [group, setGroup] = useState<string>("A");

  const { data } = useSWR<FixturesPayload>("/api/results/fixtures", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    dedupingInterval: 15_000,
  });

  const { scores, liveGroups, hasAnyScore } = useMemo(() => {
    const fixtures = sanitizeFixtures(data?.fixtures);
    const byId = buildResultsByMatchId(fixtures, LIVE_AND_DONE);
    const list: GroupMatchScore[] = [];
    byId.forEach((score, matchId) => {
      const match = MATCH_BY_ID.get(matchId);
      if (!match || match.stage !== "group") return;
      list.push({
        matchId: Number(matchId),
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        home: score.home,
        away: score.away,
      });
    });
    // Grupos con algún partido en juego ahora mismo (para el punto rojo)
    const live = new Set<string>();
    const inPlayPairs = fixtures.filter((f) => IN_PLAY_STATUSES.has(f.statusShort));
    for (const f of inPlayPairs) {
      for (const [letter, teams] of Object.entries(GROUPS)) {
        if (teams.includes(f.homeTeam) || teams.includes(f.awayTeam)) live.add(letter);
      }
    }
    return { scores: list, liveGroups: live, hasAnyScore: list.length > 0 };
  }, [data]);

  const table = useMemo(() => computeGroupTable(group, scores), [group, scores]);
  const playedInGroup = useMemo(
    () => scores.filter((s) => (GROUP_MATCH_IDS[group] || []).includes(s.matchId)).length,
    [group, scores]
  );

  return (
    <div className="card mb-3 !p-0 overflow-hidden animate-fade-in">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 cursor-pointer bg-transparent border-none text-left"
        style={{ padding: "12px 14px" }}
        aria-expanded={open}
      >
        <Table2 size={15} style={{ color: "#C99625", flexShrink: 0 }} />
        <span className="text-[13px] font-semibold text-text-warm" style={{ flex: 1 }}>
          Tablas de grupo
        </span>
        {liveGroups.size > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "#ef4444" }}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            En vivo
          </span>
        )}
        {open ? <ChevronUp size={15} className="text-text-muted" /> : <ChevronDown size={15} className="text-text-muted" />}
      </button>

      {open && (
        <div style={{ padding: "0 14px 14px" }}>
          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
            {Object.keys(GROUPS).map((letter) => (
              <button
                key={letter}
                className={`pill ${group === letter ? "active" : ""}`}
                onClick={() => setGroup(letter)}
                style={{ position: "relative" }}
              >
                {letter}
                {liveGroups.has(letter) && (
                  <span
                    className="animate-pulse"
                    style={{ position: "absolute", top: 2, right: 4, width: 5, height: 5, borderRadius: "50%", background: "#ef4444" }}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 mb-2">
            <GroupBadge group={group} />
            <span className="text-[10px] text-text-muted">
              {playedInGroup === 0
                ? "Sin partidos jugados aún"
                : `${playedInGroup}/6 partidos computados${liveGroups.has(group) ? " · incluye marcadores en juego" : ""}`}
            </span>
          </div>

          <table className="w-full" style={{ borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-text-muted">
                <th style={{ textAlign: "left", padding: "4px 2px", fontWeight: 600 }}>#</th>
                <th style={{ textAlign: "left", padding: "4px 2px", fontWeight: 600 }}>Equipo</th>
                <th style={{ textAlign: "center", padding: "4px 2px", fontWeight: 600 }}>PJ</th>
                <th style={{ textAlign: "center", padding: "4px 2px", fontWeight: 600 }}>G-E-P</th>
                <th style={{ textAlign: "center", padding: "4px 2px", fontWeight: 600 }}>DG</th>
                <th style={{ textAlign: "center", padding: "4px 2px", fontWeight: 700 }}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row, idx) => (
                <tr
                  key={row.team}
                  style={{
                    borderTop: "1px solid rgb(var(--border-default))",
                    background: idx < 2 ? "rgba(62,155,79,0.05)" : undefined,
                  }}
                >
                  <td style={{ padding: "6px 2px" }} className="text-[11px] font-bold text-text-faint">
                    {idx + 1}
                    {row.positionUndecided ? "*" : ""}
                  </td>
                  <td style={{ padding: "6px 2px" }}>
                    <CountryWithFlag country={row.team} size="sm" textClassName="text-[12px] text-text-primary" />
                  </td>
                  <td style={{ textAlign: "center", padding: "6px 2px" }} className="text-text-muted tabular-nums">{row.played}</td>
                  <td style={{ textAlign: "center", padding: "6px 2px" }} className="text-text-muted tabular-nums">
                    {row.wins}-{row.draws}-{row.losses}
                  </td>
                  <td style={{ textAlign: "center", padding: "6px 2px" }} className="tabular-nums" >
                    {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                  </td>
                  <td style={{ textAlign: "center", padding: "6px 2px" }} className="font-bold text-gold tabular-nums">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-[9px] text-text-faint mt-2" style={{ margin: "8px 0 0" }}>
            Orden según criterios FIFA: puntos, diferencia de goles, goles a favor y head-to-head.
            {table.some((r) => r.positionUndecided) ? " * Empate pendiente de fair play/sorteo." : ""}
            {hasAnyScore ? "" : " Se rellenará al disputarse los partidos."}
          </p>
        </div>
      )}
    </div>
  );
}
