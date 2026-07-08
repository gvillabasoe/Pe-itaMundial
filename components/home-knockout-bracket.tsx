"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import { getMatchesByStage, type WorldCupMatch } from "@/lib/worldcup/schedule";
import { resolveKnockoutMatchTeams } from "@/lib/worldcup/resolve-knockout";
import { TEAM_SET, type AdminResults } from "@/lib/admin-results";
import { Flag, SectionTitle } from "@/components/ui";

type Resolved = {
  match: WorldCupMatch;
  home: string;
  away: string;
  homeReal: boolean;
  awayReal: boolean;
  score: { home: number; away: number } | null;
};

function resolveMatch(match: WorldCupMatch, admin: AdminResults): Resolved {
  const { homeTeam, awayTeam } = resolveKnockoutMatchTeams(match, admin);
  const raw = admin.matchResults?.[String(match.id)];
  const score =
    raw && typeof raw.home === "number" && typeof raw.away === "number"
      ? { home: raw.home, away: raw.away }
      : null;
  return {
    match,
    home: homeTeam,
    away: awayTeam,
    homeReal: TEAM_SET.has(homeTeam),
    awayReal: TEAM_SET.has(awayTeam),
    score,
  };
}

// Extrae el id de partido de una casilla tipo "Ganador 101".
function slotMatchId(slot: string): number | null {
  const m = /(\d+)/.exec(slot);
  return m ? Number(m[1]) : null;
}

function TeamRow({ name, real, score, winner, dim }: { name: string; real: boolean; score: number | null; winner: boolean; dim: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 py-0.5 ${dim ? "opacity-50" : ""}`}>
      {real ? (
        <Flag country={name} size="sm" />
      ) : (
        <span className="inline-flex h-[14px] w-[20px] shrink-0 items-center justify-center rounded-[3px] border border-[rgb(var(--divider)/0.25)] bg-bg-2 text-[9px] text-text-faint">?</span>
      )}
      <span className={`flex-1 truncate text-[11.5px] ${real ? (winner ? "font-semibold text-text-warm" : "text-text-primary") : "text-text-faint"}`}>
        {real ? name : "Por definir"}
      </span>
      {score !== null ? (
        <span className={`text-[12px] tabular-nums ${winner ? "font-bold text-text-warm" : "text-text-muted"}`}>{score}</span>
      ) : null}
    </div>
  );
}

function BracketCard({ r, label, highlight = false }: { r: Resolved; label: string; highlight?: boolean }) {
  const decided = r.score !== null;
  const homeWin = decided && r.score!.home > r.score!.away;
  const awayWin = decided && r.score!.away > r.score!.home;
  return (
    <Link
      href={`/resultados?match=${r.match.id}`}
      className={`card block !px-2.5 !py-2 no-underline hover:!border-gold/30 ${highlight ? "!border-2 !border-gold/45" : ""}`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="rounded-full bg-bg-2 px-2 py-[1px] text-[9px] font-semibold text-text-secondary">{label}</span>
        <span className="text-[9px]" style={decided ? { color: "rgb(var(--success))" } : undefined}>
          <span className={decided ? "" : "text-text-faint"}>{decided ? "Final" : "Por jugar"}</span>
        </span>
      </div>
      <TeamRow name={r.home} real={r.homeReal} score={decided ? r.score!.home : null} winner={homeWin} dim={decided && !homeWin} />
      <TeamRow name={r.away} real={r.awayReal} score={decided ? r.score!.away : null} winner={awayWin} dim={decided && !awayWin} />
    </Link>
  );
}

function Conn() {
  return (
    <div className="flex justify-center py-0.5">
      <span className="block h-3 w-px bg-[rgb(var(--divider)/0.4)]" />
    </div>
  );
}

export function HomeKnockoutBracket({ adminResults }: { adminResults: AdminResults }) {
  const qf = getMatchesByStage("quarter-final").map((m) => resolveMatch(m, adminResults));
  const sf = getMatchesByStage("semi-final").map((m) => resolveMatch(m, adminResults));
  const finalMatch = getMatchesByStage("final")[0];
  const fin = finalMatch ? resolveMatch(finalMatch, adminResults) : null;

  const allReal = (list: Resolved[]) => list.length > 0 && list.every((r) => r.homeReal && r.awayReal);
  // Una fase se da por terminada cuando ya se conocen los equipos de la siguiente
  // (es decir, sus ganadores han avanzado en el Admin).
  const qfComplete = allReal(sf); // semifinalistas conocidos
  const sfComplete = fin ? fin.homeReal && fin.awayReal : false; // finalistas conocidos

  // Ordena semis y sus cuartos por lado usando las referencias del calendario
  // (la final apunta a las dos semis; cada semi apunta a sus dos cuartos).
  const leftSf = finalMatch ? sf.find((r) => r.match.id === slotMatchId(finalMatch.homeTeam)) : sf[0];
  const rightSf = finalMatch ? sf.find((r) => r.match.id === slotMatchId(finalMatch.awayTeam)) : sf[1];
  const qfBySf = (sfMatch?: WorldCupMatch) => {
    if (!sfMatch) return [] as Resolved[];
    const ids = [slotMatchId(sfMatch.homeTeam), slotMatchId(sfMatch.awayTeam)];
    return qf.filter((r) => ids.includes(r.match.id));
  };
  const leftQf = qfBySf(leftSf?.match);
  const rightQf = qfBySf(rightSf?.match);

  // Colapso progresivo: se ocultan las fases ya terminadas.
  const showQf = !qfComplete;
  const showSf = !sfComplete;

  // Puerta: si la primera fase visible no tiene ningún cruce con equipos reales,
  // no mostramos el cuadro (p. ej. aún estamos en fase de grupos).
  const firstStageHasTeams = showQf
    ? qf.some((r) => r.homeReal && r.awayReal)
    : showSf
    ? sf.some((r) => r.homeReal && r.awayReal)
    : !!(fin && (fin.homeReal || fin.awayReal));
  if (!firstStageHasTeams) return null;

  return (
    <section className="mb-4 animate-fade-in" style={{ animationDelay: "0.06s" }}>
      <SectionTitle icon={Trophy} accent="#D4AF37">Lo que queda del Mundial</SectionTitle>
      <div className="flex flex-col gap-2">
        {showQf ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-2">
              {leftQf.map((r) => <BracketCard key={r.match.id} r={r} label="Cuartos" />)}
            </div>
            <div className="flex flex-col gap-2">
              {rightQf.map((r) => <BracketCard key={r.match.id} r={r} label="Cuartos" />)}
            </div>
          </div>
        ) : null}

        {showQf && showSf ? <Conn /> : null}

        {showSf ? (
          <div className="grid grid-cols-2 gap-2">
            {leftSf ? <BracketCard r={leftSf} label="Semis" /> : <span />}
            {rightSf ? <BracketCard r={rightSf} label="Semis" /> : <span />}
          </div>
        ) : null}

        {showSf ? <Conn /> : null}

        {fin ? (
          <div className="mx-auto w-full max-w-[240px]">
            <BracketCard r={fin} label="Final" highlight />
          </div>
        ) : null}
      </div>
    </section>
  );
}
