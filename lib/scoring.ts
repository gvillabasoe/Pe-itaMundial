import { FIXTURES, GROUPS, KNOCKOUT_ROUND_DEFS, SCORING, type Fixture, type KnockoutPick, type MatchPick, type Team } from "@/lib/data";
import { KNOCKOUT_ADMIN_COUNTS, hasConfiguredAdminResults, type AdminResults, type KnockoutRoundKey } from "@/lib/admin-results";
import { WORLD_CUP_MATCHES } from "@/lib/worldcup/schedule";
import { normalizeCountryKey } from "@/lib/flags";

const FIXTURE_BY_ID = new Map(FIXTURES.map((fixture) => [fixture.id, fixture]));
type AdminMatchMapping = { matchId: string; swapped: boolean };
const WORLD_CUP_GROUP_MATCH_BY_PAIR = new Map<string, AdminMatchMapping>();
const ADMIN_MATCH_BY_FIXTURE_ID = new Map<string, AdminMatchMapping>();

const ADMIN_ROUND_BY_PICK_ROUND: Record<KnockoutRoundKey, KnockoutRoundKey> = {
  dieciseisavos: "octavos",
  octavos: "cuartos",
  cuartos: "semis",
  semis: "final",
  final: "final",
};

function buildMatchKey(homeTeam: string, awayTeam: string) {
  return `${normalizeCountryKey(homeTeam)}|${normalizeCountryKey(awayTeam)}`;
}

WORLD_CUP_MATCHES.filter((match) => match.stage === "group").forEach((match) => {
  const matchId = String(match.id);
  WORLD_CUP_GROUP_MATCH_BY_PAIR.set(buildMatchKey(match.homeTeam, match.awayTeam), { matchId, swapped: false });
  WORLD_CUP_GROUP_MATCH_BY_PAIR.set(buildMatchKey(match.awayTeam, match.homeTeam), { matchId, swapped: true });
});

FIXTURES.forEach((fixture) => {
  const mapping = WORLD_CUP_GROUP_MATCH_BY_PAIR.get(buildMatchKey(fixture.homeTeam, fixture.awayTeam));
  if (mapping) {
    ADMIN_MATCH_BY_FIXTURE_ID.set(fixture.id, mapping);
  }
});

if (process.env.NODE_ENV !== "production" && typeof window === "undefined") {
  const groupFixtures = FIXTURES.filter((f) => f.stage === "groups");
  const unmapped = groupFixtures.filter((f) => !ADMIN_MATCH_BY_FIXTURE_ID.has(f.id));
  if (unmapped.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[scoring] ${unmapped.length} fixtures de grupo sin matchId del schedule oficial:`,
      unmapped.map((f) => `${f.id} (${f.homeTeam} vs ${f.awayTeam})`)
    );
  }
}

function cloneMatchPicks(matchPicks: Record<string, MatchPick>) {
  return Object.fromEntries(Object.entries(matchPicks || {}).map(([k, v]) => [k, { ...v }]));
}

function cloneKnockoutPicks(knockoutPicks: Record<string, KnockoutPick[]>) {
  return Object.fromEntries(Object.entries(knockoutPicks || {}).map(([k, picks]) => [k, (picks || []).map((p) => ({ ...p }))]));
}

function cloneTeam(team: Team): Team {
  return {
    ...team,
    matchPicks: cloneMatchPicks(team.matchPicks),
    doubleMatches: { ...(team.doubleMatches || {}) },
    knockoutPicks: cloneKnockoutPicks(team.knockoutPicks),
    groupOrderPicks: Object.fromEntries(Object.entries(team.groupOrderPicks || {}).map(([k, v]) => [k, [...v]])),
    specials: { ...team.specials },
    thirdPlacePick: team.thirdPlacePick,
    roundOf32Teams: team.roundOf32Teams ? [...team.roundOf32Teams] : undefined,
    bestThirdGroups: team.bestThirdGroups ? [...team.bestThirdGroups] : undefined,
    bestThirdAssignments: team.bestThirdAssignments ? { ...team.bestThirdAssignments } : undefined,
    createdAt: team.createdAt,
    locked: team.locked,
    source: team.source,
  };
}

function isGroupConfigured(group: string, adminResults: AdminResults) {
  const positions = GROUPS[group].map((t) => adminResults.groupPositions[t]).filter((v) => v > 0);
  if (positions.length !== 4) return false;
  const unique = new Set(positions);
  return unique.size === 4 && unique.has(1) && unique.has(2) && unique.has(3) && unique.has(4);
}

function getConfiguredKnockoutTeams(roundKey: KnockoutRoundKey, adminResults: AdminResults) {
  const adminRoundKey = ADMIN_ROUND_BY_PICK_ROUND[roundKey];
  const required = KNOCKOUT_ADMIN_COUNTS[adminRoundKey] || 0;
  const selected = adminResults.knockoutRounds[adminRoundKey].filter(Boolean);
  if (selected.length !== required) return null;
  return new Set(selected);
}

function isSpecialConfigured(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value);
  return String(value ?? "").trim() !== "";
}

function resolveGroupMatchResult(fixtureId: string, adminResults: AdminResults) {
  const mapping = ADMIN_MATCH_BY_FIXTURE_ID.get(fixtureId);
  if (!mapping) return null;
  const result = adminResults.matchResults[mapping.matchId];
  if (typeof result?.home !== "number" || typeof result?.away !== "number") return null;
  if (!mapping.swapped) return result;
  return { ...result, home: result.away, away: result.home };
}

function getResultSign(home: number, away: number) {
  if (home === away) return "draw" as const;
  return home > away ? ("home" as const) : ("away" as const);
}

function scoreMatchPick(pick: MatchPick & { home: number; away: number }, actualHome: number, actualAway: number, isDouble: boolean) {
  const exact = pick.home === actualHome && pick.away === actualAway;
  if (exact) {
    return { points: isDouble ? SCORING.partidoDobleExacto : SCORING.resultadoExactoTotal, status: "correct" as const };
  }
  const ps = getResultSign(pick.home, pick.away);
  const as = getResultSign(actualHome, actualAway);
  if (ps === as) {
    return { points: isDouble ? SCORING.partidoDobleSigno : SCORING.signo, status: "sign" as const };
  }
  return { points: 0, status: "wrong" as const };
}

function scoreGroupMatchPicks(team: Team, adminResults: AdminResults) {
  let points = 0;
  const matchPicks = cloneMatchPicks(team.matchPicks);
  Object.entries(matchPicks).forEach(([fixtureId, pick]) => {
    const actual = resolveGroupMatchResult(fixtureId, adminResults);
    const hasPickScore = typeof pick.home === "number" && typeof pick.away === "number";
    if (!actual || !hasPickScore) {
      matchPicks[fixtureId] = { ...pick, points: null, status: "pending" };
      return;
    }
    const fixture = FIXTURE_BY_ID.get(fixtureId) as Fixture | undefined;
    const isDouble = Boolean(fixture?.group && team.doubleMatches?.[fixture.group] === fixtureId);
    const next = scoreMatchPick(pick as MatchPick & { home: number; away: number }, actual.home as number, actual.away as number, isDouble);
    matchPicks[fixtureId] = { ...pick, points: next.points, status: next.status };
    points += next.points;
  });
  return { points, matchPicks };
}

function scoreGroupPositions(team: Team, adminResults: AdminResults) {
  let points = 0;
  Object.keys(GROUPS).forEach((group) => {
    if (!isGroupConfigured(group, adminResults)) return;
    const picks = team.groupOrderPicks[group] || [];
    picks.forEach((country, idx) => {
      if (adminResults.groupPositions[country] === idx + 1) points += SCORING.posicionGrupo;
    });
  });
  return points;
}

function scoreKnockoutRounds(team: Team, adminResults: AdminResults) {
  let points = 0;
  const knockoutPicks = cloneKnockoutPicks(team.knockoutPicks);
  KNOCKOUT_ROUND_DEFS.forEach((round) => {
    const actualTeams = getConfiguredKnockoutTeams(round.key, adminResults);
    const seen = new Set<string>();
    knockoutPicks[round.key] = (knockoutPicks[round.key] || []).map((pick) => {
      if (!actualTeams) return { ...pick, points: null, status: "pending" };
      const duplicate = seen.has(pick.country);
      seen.add(pick.country);
      const correct = !duplicate && actualTeams.has(pick.country);
      const pickPoints = correct ? round.pts : 0;
      points += pickPoints;
      return { ...pick, points: pickPoints, status: correct ? "correct" : "wrong" };
    });
  });
  return { points, knockoutPicks };
}

function scorePodium(team: Team, adminResults: AdminResults) {
  let points = 0;
  if (adminResults.podium.campeon && team.championPick === adminResults.podium.campeon) points += SCORING.posicionesFinales.campeon;
  if (adminResults.podium.subcampeon && team.runnerUpPick === adminResults.podium.subcampeon) points += SCORING.posicionesFinales.subcampeon;
  if (adminResults.podium.tercero && team.thirdPlacePick === adminResults.podium.tercero) points += SCORING.posicionesFinales.tercero;
  return points;
}

function scoreSpecials(team: Team, adminResults: AdminResults) {
  let points = 0;
  const sr = adminResults.specialResults;
  if (isSpecialConfigured(sr.mejorJugador) && team.specials.mejorJugador === sr.mejorJugador) points += SCORING.especiales.mejorJugador;
  if (isSpecialConfigured(sr.mejorJoven) && team.specials.mejorJoven === sr.mejorJoven) points += SCORING.especiales.mejorJoven;
  if (isSpecialConfigured(sr.maxGoleador) && team.specials.maxGoleador === sr.maxGoleador) points += SCORING.especiales.maxGoleador;
  if (isSpecialConfigured(sr.maxAsistente) && team.specials.maxAsistente === sr.maxAsistente) points += SCORING.especiales.maxAsistente;
  if (isSpecialConfigured(sr.mejorPortero) && team.specials.mejorPortero === sr.mejorPortero) points += SCORING.especiales.mejorPortero;
  if (isSpecialConfigured(sr.maxGoleadorEsp) && team.specials.maxGoleadorEsp === sr.maxGoleadorEsp) points += SCORING.especiales.maxGoleadorEsp;
  if (isSpecialConfigured(sr.primerGolEsp) && team.specials.primerGolEsp === sr.primerGolEsp) points += SCORING.especiales.primerGolEsp;
  if (isSpecialConfigured(sr.revelacion) && team.specials.revelacion === sr.revelacion) points += SCORING.especiales.revelacion;
  if (isSpecialConfigured(sr.decepcion) && team.specials.decepcion === sr.decepcion) points += SCORING.especiales.decepcion;
  if (typeof sr.minutoPrimerGol === "number" && team.specials.minutoPrimerGol === sr.minutoPrimerGol) points += SCORING.especiales.minutoPrimerGol;
  return points;
}

export function scoreParticipants(participants: Team[], adminResults: AdminResults) {
  const baseTeams = participants.map((p) => cloneTeam(p));

  if (!hasConfiguredAdminResults(adminResults)) {
    baseTeams.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.finalPhasePoints !== a.finalPhasePoints) return b.finalPhasePoints - a.finalPhasePoints;
      if (b.groupPoints !== a.groupPoints) return b.groupPoints - a.groupPoints;
      return a.name.localeCompare(b.name, "es");
    });
    let r = 1;
    baseTeams.forEach((team, i) => {
      if (i > 0 && team.totalPoints < baseTeams[i - 1].totalPoints) r = i + 1;
      team.currentRank = r;
    });
    return baseTeams;
  }

  const scored = baseTeams.map((p) => {
    const t = cloneTeam(p);
    const matchScores = scoreGroupMatchPicks(t, adminResults);
    const groupPos = scoreGroupPositions(t, adminResults);
    const ko = scoreKnockoutRounds(t, adminResults);
    const podium = scorePodium(t, adminResults);
    const specials = scoreSpecials(t, adminResults);
    t.matchPicks = matchScores.matchPicks;
    t.groupPoints = matchScores.points + groupPos;
    t.knockoutPicks = ko.knockoutPicks;
    t.finalPhasePoints = ko.points + podium;
    t.specialPoints = specials;
    t.totalPoints = t.groupPoints + t.finalPhasePoints + t.specialPoints;
    return t;
  });

  scored.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.finalPhasePoints !== a.finalPhasePoints) return b.finalPhasePoints - a.finalPhasePoints;
    if (b.groupPoints !== a.groupPoints) return b.groupPoints - a.groupPoints;
    return a.name.localeCompare(b.name, "es");
  });

  let r = 1;
  scored.forEach((t, i) => {
    if (i > 0 && t.totalPoints < scored[i - 1].totalPoints) r = i + 1;
    t.currentRank = r;
  });

  return scored;
}
