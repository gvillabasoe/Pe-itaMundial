import { GROUPS } from "@/lib/data";
import { WORLD_CUP_MATCHES } from "@/lib/worldcup/schedule";

// ════════════════════════════════════════════════════════════
// Tablas de grupo calculadas con los criterios oficiales FIFA del
// Mundial (art. de desempate de fase de grupos):
//   a) puntos; b) diferencia de goles GLOBAL; c) goles a favor GLOBAL;
//   d) puntos head-to-head entre los empatados; e) diferencia h2h;
//   f) goles a favor h2h; g) fair play / sorteo → NO computable aquí.
// Si tras (f) persiste un empate, la posición se marca como NO decidida
// y el autocompletado del admin se abstiene (lo resuelve el humano).
// ════════════════════════════════════════════════════════════

export interface GroupMatchScore {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  home: number;
  away: number;
}

export interface GroupTableRow {
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  /** true si su posición exacta NO pudo decidirse con los criterios a–f */
  positionUndecided: boolean;
}

const TEAM_GROUP = new Map<string, string>();
Object.entries(GROUPS).forEach(([letter, teams]) => {
  teams.forEach((team) => TEAM_GROUP.set(team, letter));
});

/** Letra de grupo de un partido de fase de grupos (o null) */
export function getGroupLetterForPair(homeTeam: string, awayTeam: string): string | null {
  const g = TEAM_GROUP.get(homeTeam);
  return g && TEAM_GROUP.get(awayTeam) === g ? g : null;
}

/** matchIds oficiales de cada grupo (6 por grupo) */
export const GROUP_MATCH_IDS: Record<string, number[]> = (() => {
  const out: Record<string, number[]> = {};
  Object.keys(GROUPS).forEach((letter) => {
    out[letter] = [];
  });
  WORLD_CUP_MATCHES.filter((m) => m.stage === "group").forEach((m) => {
    const letter = getGroupLetterForPair(m.homeTeam, m.awayTeam);
    if (letter) out[letter].push(m.id);
  });
  return out;
})();

interface Acc {
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

function emptyAcc(team: string): Acc {
  return { team, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
}

function addResult(acc: Acc, gf: number, gc: number) {
  acc.played += 1;
  acc.goalsFor += gf;
  acc.goalsAgainst += gc;
  if (gf > gc) {
    acc.wins += 1;
    acc.points += 3;
  } else if (gf === gc) {
    acc.draws += 1;
    acc.points += 1;
  } else {
    acc.losses += 1;
  }
}

function buildAccumulators(teams: string[], scores: GroupMatchScore[]): Map<string, Acc> {
  const accs = new Map(teams.map((t) => [t, emptyAcc(t)]));
  for (const s of scores) {
    const home = accs.get(s.homeTeam);
    const away = accs.get(s.awayTeam);
    if (!home || !away) continue;
    addResult(home, s.home, s.away);
    addResult(away, s.away, s.home);
  }
  return accs;
}

/** Compara por criterios globales a–c. <0 si a va antes. 0 = empate a–c. */
function compareOverall(a: Acc, b: Acc): number {
  if (b.points !== a.points) return b.points - a.points;
  const diffA = a.goalsFor - a.goalsAgainst;
  const diffB = b.goalsFor - b.goalsAgainst;
  if (diffB !== diffA) return diffB - diffA;
  return b.goalsFor - a.goalsFor;
}

/**
 * Ordena un grupo aplicando a–f. Devuelve filas en orden y, por fila, si su
 * posición quedó decidida. El empate residual (g/h: fair play, sorteo) deja
 * `positionUndecided: true` en las filas implicadas.
 */
export function computeGroupTable(letter: string, scores: GroupMatchScore[]): GroupTableRow[] {
  const teams = GROUPS[letter] || [];
  const accs = buildAccumulators(teams, scores);
  const groupScores = scores.filter(
    (s) => TEAM_GROUP.get(s.homeTeam) === letter && TEAM_GROUP.get(s.awayTeam) === letter
  );

  const ordered = [...accs.values()].sort((a, b) => {
    const overall = compareOverall(a, b);
    if (overall !== 0) return overall;
    // d–f: mini-liga entre los empatados a–c (todo el subconjunto empatado)
    const tiedTeams = [...accs.values()]
      .filter((x) => compareOverall(x, a) === 0)
      .map((x) => x.team);
    const h2hScores = groupScores.filter(
      (s) => tiedTeams.includes(s.homeTeam) && tiedTeams.includes(s.awayTeam)
    );
    const h2h = buildAccumulators(tiedTeams, h2hScores);
    const ha = h2h.get(a.team)!;
    const hb = h2h.get(b.team)!;
    const h2hCmp = compareOverall(ha, hb);
    if (h2hCmp !== 0) return h2hCmp;
    return a.team.localeCompare(b.team, "es"); // orden estable; se marcará indeciso
  });

  // Marcar indecisos: vecinos con empate total a–f
  const undecided = new Set<string>();
  const fullyTied = (a: Acc, b: Acc): boolean => {
    if (compareOverall(a, b) !== 0) return false;
    const tiedTeams = [...accs.values()].filter((x) => compareOverall(x, a) === 0).map((x) => x.team);
    const h2hScores = groupScores.filter(
      (s) => tiedTeams.includes(s.homeTeam) && tiedTeams.includes(s.awayTeam)
    );
    const h2h = buildAccumulators(tiedTeams, h2hScores);
    return compareOverall(h2h.get(a.team)!, h2h.get(b.team)!) === 0;
  };
  for (let i = 0; i < ordered.length - 1; i++) {
    if (fullyTied(ordered[i], ordered[i + 1])) {
      undecided.add(ordered[i].team);
      undecided.add(ordered[i + 1].team);
    }
  }

  return ordered.map((acc) => ({
    team: acc.team,
    played: acc.played,
    wins: acc.wins,
    draws: acc.draws,
    losses: acc.losses,
    goalsFor: acc.goalsFor,
    goalsAgainst: acc.goalsAgainst,
    goalDiff: acc.goalsFor - acc.goalsAgainst,
    points: acc.points,
    positionUndecided: undecided.has(acc.team),
  }));
}

/**
 * Posiciones finales (1–4) de un grupo COMPLETO (6 partidos). Devuelve null
 * si falta algún partido o si algún empate no es decidible con a–f.
 */
export function decideFinalGroupPositions(
  letter: string,
  scores: GroupMatchScore[]
): Map<string, 1 | 2 | 3 | 4> | null {
  const groupIds = new Set(GROUP_MATCH_IDS[letter] || []);
  const played = scores.filter((s) => groupIds.has(s.matchId));
  if (played.length !== groupIds.size || groupIds.size === 0) return null;

  const table = computeGroupTable(letter, played);
  if (table.some((row) => row.positionUndecided)) return null;

  const out = new Map<string, 1 | 2 | 3 | 4>();
  table.forEach((row, idx) => out.set(row.team, (idx + 1) as 1 | 2 | 3 | 4));
  return out;
}
