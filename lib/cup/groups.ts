// ════════════════════════════════════════════════════════════
// MODO COPA — fase de grupos
// ════════════════════════════════════════════════════════════
// Calendario (liguilla), tablas (3/1/0, GF/GA = goles = puntos por jornada) y
// resolución de los 32 clasificados (2 primeros + 4 mejores terceros).

import type { Ventana } from "@/lib/scoring";
import type { CupFixture, GroupRow } from "@/lib/cup/types";
import { FOUR_TEAM_GROUPS, GROUP_LABELS, THIRD_SLOT_REGION, assignThirds } from "@/lib/cup/template";

export type GoalsMap = Record<string, Record<Ventana, number>>;

const GROUP_WINDOWS: Ventana[] = ["J1", "J2", "J3"];

// Liguilla por el método del círculo. Con 4 equipos → 3 rondas; con 3 → 3
// rondas con un descanso por equipo. Tomamos las 3 primeras (J1, J2, J3).
function roundRobinRounds(teams: string[]): string[][][] {
  const list = [...teams];
  if (list.length % 2 === 1) list.push("__BYE__");
  const n = list.length;
  const arr = [...list];
  const rounds: string[][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: string[][] = [];
    for (let i = 0; i < n / 2; i++) {
      const home = arr[i];
      const away = arr[n - 1 - i];
      if (home !== "__BYE__" && away !== "__BYE__") pairs.push([home, away]);
    }
    rounds.push(pairs);
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop() as string);
    arr.splice(0, arr.length, fixed, ...rest);
  }
  return rounds;
}

// Cruces de un grupo, repartidos en J1/J2/J3.
export function fixturesForGroup(teams: string[], goals: GoalsMap, resolved: Record<Ventana, boolean>): CupFixture[] {
  const rounds = roundRobinRounds(teams).slice(0, 3);
  const out: CupFixture[] = [];
  rounds.forEach((pairs, idx) => {
    const ventana = GROUP_WINDOWS[idx];
    pairs.forEach(([homeId, awayId]) => {
      const played = resolved[ventana];
      out.push({
        ventana,
        homeId,
        awayId,
        homeGoals: played ? goals[homeId]?.[ventana] ?? 0 : null,
        awayGoals: played ? goals[awayId]?.[ventana] ?? 0 : null,
      });
    });
  });
  return out;
}

// Tabla de un grupo a partir de sus cruces.
export function standingsForGroup(teams: string[], fixtures: CupFixture[]): GroupRow[] {
  const rows = new Map<string, GroupRow>();
  teams.forEach((id) => rows.set(id, { teamId: id, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 }));

  fixtures.forEach((fx) => {
    if (fx.homeGoals === null || fx.awayGoals === null) return;
    const h = rows.get(fx.homeId);
    const a = rows.get(fx.awayId);
    if (!h || !a) return;
    h.pj++; a.pj++;
    h.gf += fx.homeGoals; h.gc += fx.awayGoals;
    a.gf += fx.awayGoals; a.gc += fx.homeGoals;
    if (fx.homeGoals > fx.awayGoals) { h.g++; h.pts += 3; a.p++; }
    else if (fx.homeGoals < fx.awayGoals) { a.g++; a.pts += 3; h.p++; }
    else { h.e++; a.e++; h.pts += 1; a.pts += 1; }
  });

  const list = [...rows.values()];
  list.forEach((r) => (r.dg = r.gf - r.gc));
  list.sort((x, y) => y.pts - x.pts || y.dg - x.dg || y.gf - x.gf || x.teamId.localeCompare(y.teamId));
  return list;
}

export interface CupGroupsResult {
  standings: Record<string, GroupRow[]>;
  fixtures: Record<string, CupFixture[]>;
  winners: Record<string, string | undefined>; // "A".. -> teamId
  runners: Record<string, string | undefined>;
  rankedThirds: Array<{ group: string; teamId: string; row: GroupRow }>;
  thirdSlotTeam: Record<number, string | undefined>; // 1..4 -> teamId
  // resolveRef("1A"|"2B"|"T3") -> teamId | undefined
  resolveRef: (ref: string) => string | undefined;
}

export function computeGroups(
  groups: Record<string, string[]>,
  goals: GoalsMap,
  resolved: Record<Ventana, boolean>
): CupGroupsResult {
  const standings: Record<string, GroupRow[]> = {};
  const fixtures: Record<string, CupFixture[]> = {};
  const winners: Record<string, string | undefined> = {};
  const runners: Record<string, string | undefined> = {};

  GROUP_LABELS.forEach((label) => {
    const teams = groups[label] || [];
    const fx = fixturesForGroup(teams, goals, resolved);
    const table = standingsForGroup(teams, fx);
    fixtures[label] = fx;
    standings[label] = table;
    winners[label] = table[0]?.teamId;
    runners[label] = table[1]?.teamId;
  });

  // Mejores terceros (solo grupos de 4).
  const thirds = FOUR_TEAM_GROUPS
    .map((g) => {
      const row = standings[g]?.[2];
      return row ? { group: g as string, teamId: row.teamId, row } : null;
    })
    .filter((x): x is { group: string; teamId: string; row: GroupRow } => Boolean(x))
    .sort((a, b) => b.row.pts - a.row.pts || b.row.dg - a.row.dg || b.row.gf - a.row.gf || a.teamId.localeCompare(b.teamId));

  const rankedThirds = thirds.slice(0, 4);
  const regionByGroup = assignThirds(rankedThirds.map((t) => t.group)); // region -> group
  const thirdSlotTeam: Record<number, string | undefined> = {};
  for (const slot of [1, 2, 3, 4]) {
    const region = THIRD_SLOT_REGION[slot];
    const group = regionByGroup[region];
    thirdSlotTeam[slot] = group ? standings[group]?.[2]?.teamId : undefined;
  }

  const resolveRef = (ref: string): string | undefined => {
    if (ref.startsWith("T")) return thirdSlotTeam[Number(ref.slice(1))];
    const pos = ref[0];
    const label = ref.slice(1);
    if (pos === "1") return winners[label];
    if (pos === "2") return runners[label];
    return undefined;
  };

  return { standings, fixtures, winners, runners, rankedThirds, thirdSlotTeam, resolveRef };
}
