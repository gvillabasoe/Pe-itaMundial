// ════════════════════════════════════════════════════════════
// MODO COPA — cuadro final
// ════════════════════════════════════════════════════════════
// Resuelve el cuadro de 32 desde la plantilla fija y hace avanzar a los
// ganadores. El marcador de cada cruce son los goles (puntos) de esa ventana.
// Empate en eliminatoria → desempate por acumulado general; si persiste, id.

import type { Ventana } from "@/lib/scoring";
import type { BracketMatch, CupRound } from "@/lib/cup/types";
import { R32_TEMPLATE } from "@/lib/cup/template";
import type { GoalsMap } from "@/lib/cup/groups";

export type TotalsMap = Record<string, number>;

const ROUND_WINDOW: Record<CupRound, Ventana> = {
  R32: "R32", R16: "R16", QF: "QF", SF: "SF", FINAL: "FINAL", "3P": "FINAL",
};

export interface CupBracket {
  r32: BracketMatch[];
  r16: BracketMatch[];
  qf: BracketMatch[];
  sf: BracketMatch[];
  final: BracketMatch;
  third: BracketMatch;
  championId?: string;
}

function decide(
  homeId: string | undefined,
  awayId: string | undefined,
  ventana: Ventana,
  goals: GoalsMap,
  active: Record<Ventana, boolean>,
  resolved: Record<Ventana, boolean>,
  totals: TotalsMap
): { homeGoals: number | null; awayGoals: number | null; winnerId?: string; loserId?: string } {
  const showGoals = active[ventana];
  const hg = showGoals && homeId ? goals[homeId]?.[ventana] ?? 0 : null;
  const ag = showGoals && awayId ? goals[awayId]?.[ventana] ?? 0 : null;

  // Solo se declara ganador cuando la ronda está CERRADA (no en vivo).
  if (!resolved[ventana] || !homeId || !awayId) {
    return { homeGoals: hg, awayGoals: ag };
  }
  const a = goals[homeId]?.[ventana] ?? 0;
  const b = goals[awayId]?.[ventana] ?? 0;
  let winnerId: string;
  if (a !== b) winnerId = a > b ? homeId : awayId;
  else {
    const ta = totals[homeId] ?? 0;
    const tb = totals[awayId] ?? 0;
    if (ta !== tb) winnerId = ta > tb ? homeId : awayId;
    else winnerId = homeId <= awayId ? homeId : awayId;
  }
  const loserId = winnerId === homeId ? awayId : homeId;
  return { homeGoals: a, awayGoals: b, winnerId, loserId };
}

function makeMatch(
  id: string,
  ronda: CupRound,
  homeRef: string,
  awayRef: string,
  homeId: string | undefined,
  awayId: string | undefined,
  goals: GoalsMap,
  active: Record<Ventana, boolean>,
  resolved: Record<Ventana, boolean>,
  totals: TotalsMap
): BracketMatch {
  const d = decide(homeId, awayId, ROUND_WINDOW[ronda], goals, active, resolved, totals);
  return { id, ronda, homeRef, awayRef, homeId, awayId, winnerId: d.winnerId, homeGoals: d.homeGoals, awayGoals: d.awayGoals };
}

export function buildBracket(
  resolveRef: (ref: string) => string | undefined,
  goals: GoalsMap,
  active: Record<Ventana, boolean>,
  resolved: Record<Ventana, boolean>,
  totals: TotalsMap
): CupBracket {
  // Dieciseisavos desde la plantilla.
  const r32 = R32_TEMPLATE.map((m) =>
    makeMatch(m.id, "R32", m.home, m.away, resolveRef(m.home), resolveRef(m.away), goals, active, resolved, totals)
  );

  const byRegion = (r: number) => r32.filter((_, i) => R32_TEMPLATE[i].region === r);

  // Octavos y cuartos por región.
  const r16: BracketMatch[] = [];
  const qf: BracketMatch[] = [];
  for (const region of [1, 2, 3, 4]) {
    const m = byRegion(region); // 4 cruces en orden
    const o1 = makeMatch(`O-${region}-1`, "R16", m[0].id, m[1].id, m[0].winnerId, m[1].winnerId, goals, active, resolved, totals);
    const o2 = makeMatch(`O-${region}-2`, "R16", m[2].id, m[3].id, m[2].winnerId, m[3].winnerId, goals, active, resolved, totals);
    r16.push(o1, o2);
    qf.push(makeMatch(`Q-${region}`, "QF", o1.id, o2.id, o1.winnerId, o2.winnerId, goals, active, resolved, totals));
  }

  // Semifinales: SF1 = región1 vs región2 ; SF2 = región3 vs región4.
  const sf1 = makeMatch("SF-1", "SF", qf[0].id, qf[1].id, qf[0].winnerId, qf[1].winnerId, goals, active, resolved, totals);
  const sf2 = makeMatch("SF-2", "SF", qf[2].id, qf[3].id, qf[2].winnerId, qf[3].winnerId, goals, active, resolved, totals);
  const sf = [sf1, sf2];

  const final = makeMatch("FINAL", "FINAL", sf1.id, sf2.id, sf1.winnerId, sf2.winnerId, goals, active, resolved, totals);

  const loserOf = (mm: BracketMatch) =>
    mm.winnerId ? (mm.winnerId === mm.homeId ? mm.awayId : mm.homeId) : undefined;
  const third = makeMatch("3P", "3P", sf1.id, sf2.id, loserOf(sf1), loserOf(sf2), goals, active, resolved, totals);

  return { r32, r16, qf, sf, final, third, championId: final.winnerId };
}
