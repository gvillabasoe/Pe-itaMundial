import { FIXTURES, GROUPS, KNOCKOUT_ROUND_DEFS, SCORING, type Fixture, type KnockoutPick, type MatchPick, type Team } from "@/lib/data";
import type { AdminResults, KnockoutRoundKey } from "@/lib/admin-results";
import { WORLD_CUP_MATCHES } from "@/lib/worldcup/schedule";
import { normalizeCountryKey } from "@/lib/flags";

const FIXTURE_BY_ID = new Map(FIXTURES.map((fixture) => [fixture.id, fixture]));
const WORLD_CUP_GROUP_MATCH_ID_BY_PAIR = new Map<string, string>();
const ADMIN_MATCH_ID_BY_FIXTURE_ID = new Map<string, string>();

function buildMatchKey(homeTeam: string, awayTeam: string) {
  return `${normalizeCountryKey(homeTeam)}|${normalizeCountryKey(awayTeam)}`;
}

WORLD_CUP_MATCHES.filter((match) => match.stage === "group").forEach((match) => {
  WORLD_CUP_GROUP_MATCH_ID_BY_PAIR.set(buildMatchKey(match.homeTeam, match.awayTeam), String(match.id));
});

FIXTURES.forEach((fixture) => {
  const matchId = WORLD_CUP_GROUP_MATCH_ID_BY_PAIR.get(buildMatchKey(fixture.homeTeam, fixture.awayTeam));
  if (matchId) {
    ADMIN_MATCH_ID_BY_FIXTURE_ID.set(fixture.id, matchId);
  }
});

function cloneMatchPicks(matchPicks: Record<string, MatchPick>) {
  return Object.fromEntries(
    Object.entries(matchPicks || {}).map(([key, value]) => [key, { ...value }])
  );
}

function cloneKnockoutPicks(knockoutPicks: Record<string, KnockoutPick[]>) {
  return Object.fromEntries(
    Object.entries(knockoutPicks || {}).map(([key, picks]) => [key, (picks || []).map((pick) => ({ ...pick }))])
  );
}

function cloneTeam(team: Team): Team {
  return {
    ...team,
    matchPicks: cloneMatchPicks(team.matchPicks),
    doubleMatches: { ...(team.doubleMatches || {}) },
    knockoutPicks: cloneKnockoutPicks(team.knockoutPicks),
    groupOrderPicks: Object.fromEntries(
      Object.entries(team.groupOrderPicks || {}).map(([key, value]) => [key, [...value]])
    ),
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
  const positions = GROUPS[group].map((team) => adminResults.groupPositions[team]).filter((value) => value > 0);
  if (positions.length !== 4) return false;
  const unique = new Set(positions);
  return unique.size === 4 && unique.has(1) && unique.has(2) && unique.has(3) && unique.has(4);
}

function isRoundConfigured(roundKey: KnockoutRoundKey, adminResults: AdminResults) {
  const required = KNOCKOUT_ROUND_DEFS.find((round) => round.key === roundKey)?.count || 0;
  const selected = adminResults.knockoutRounds[roundKey].filter(Boolean);
  return selected.length === required;
}

function isSpecialConfigured(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value);
  return String(value ?? "").trim() !== "";
}

function resolveGroupMatchResult(fixtureId: string, adminResults: AdminResults) {
  const matchId = ADMIN_MATCH_ID_BY_FIXTURE_ID.get(fixtureId);
  if (!matchId) return null;
  const result = adminResults.matchResults[matchId];
  if (typeof result?.home !== "number" || typeof result?.away !== "number") return null;
  return result;
}

function getResultSign(home: number, away: number) {
  if (home === away) return "draw" as const;
  return home > away ? ("home" as const) : ("away" as const);
}

function scoreMatchPick(pick: MatchPick, actualHome: number, actualAway: number, isDouble: boolean) {
  const exact = pick.home === actualHome && pick.away === actualAway;

  if (exact) {
    return {
      points: isDouble ? SCORING.partidoDobleExacto : SCORING.resultadoExactoTotal,
      status: "correct" as const,
    };
  }

  const predictedSign = getResultSign(pick.home, pick.away);
  const actualSign = getResultSign(actualHome, actualAway);

  if (predictedSign === actualSign) {
    return {
      points: isDouble ? SCORING.partidoDobleSigno : SCORING.signo,
      status: "sign" as const,
    };
  }

  return {
    points: 0,
    status: "wrong" as const,
  };
}

function scoreGroupMatchPicks(team: Team, adminResults: AdminResults) {
  let points = 0;
  const matchPicks = cloneMatchPicks(team.matchPicks);

  Object.entries(matchPicks).forEach(([fixtureId, pick]) => {
    const actual = resolveGroupMatchResult(fixtureId, adminResults);

    if (!actual) {
      matchPicks[fixtureId] = { ...pick, points: null, status: "pending" };
      return;
    }

    const fixture = FIXTURE_BY_ID.get(fixtureId) as Fixture | undefined;
    const isDouble = Boolean(fixture?.group && team.doubleMatches?.[fixture.group] === fixtureId);
    const nextScore = scoreMatchPick(pick, actual.home as number, actual.away as number, isDouble);

    matchPicks[fixtureId] = {
      ...pick,
      points: nextScore.points,
      status: nextScore.status,
    };

    points += nextScore.points;
  });

  return { points, matchPicks };
}

function scoreGroupPositions(team: Team, adminResults: AdminResults) {
  let points = 0;

  Object.keys(GROUPS).forEach((group) => {
    if (!isGroupConfigured(group, adminResults)) {
      return;
    }

    const picks = team.groupOrderPicks[group] || [];
    picks.forEach((country, index) => {
      if (adminResults.groupPositions[country] === index + 1) {
        points += SCORING.posicionGrupo;
      }
    });
  });

  return points;
}

function scoreKnockoutRounds(team: Team, adminResults: AdminResults) {
  let points = 0;
  const knockoutPicks = cloneKnockoutPicks(team.knockoutPicks);

  KNOCKOUT_ROUND_DEFS.forEach((round) => {
    const configured = isRoundConfigured(round.key, adminResults);
    const actualTeams = configured ? new Set(adminResults.knockoutRounds[round.key].filter(Boolean)) : new Set<string>();
    const seen = new Set<string>();

    knockoutPicks[round.key] = (knockoutPicks[round.key] || []).map((pick) => {
      if (!configured) {
        return { ...pick, points: null, status: "pending" };
      }

      const duplicate = seen.has(pick.country);
      seen.add(pick.country);
      const correct = !duplicate && actualTeams.has(pick.country);
      const pickPoints = correct ? round.pts : 0;
      points += pickPoints;

      return {
        ...pick,
        points: pickPoints,
        status: correct ? "correct" : "wrong",
      };
    });
  });

  return { points, knockoutPicks };
}

function scorePodium(team: Team, adminResults: AdminResults) {
  let points = 0;

  if (adminResults.podium.campeon && team.championPick === adminResults.podium.campeon) {
    points += SCORING.posicionesFinales.campeon;
  }

  if (adminResults.podium.subcampeon && team.runnerUpPick === adminResults.podium.subcampeon) {
    points += SCORING.posicionesFinales.subcampeon;
  }

  if (adminResults.podium.tercero && team.thirdPlacePick === adminResults.podium.tercero) {
    points += SCORING.posicionesFinales.tercero;
  }

  return points;
}

function scoreSpecials(team: Team, adminResults: AdminResults) {
  let points = 0;
  const { specialResults } = adminResults;

  if (isSpecialConfigured(specialResults.mejorJugador) && team.specials.mejorJugador === specialResults.mejorJugador) {
    points += SCORING.especiales.mejorJugador;
  }

  if (isSpecialConfigured(specialResults.mejorJoven) && team.specials.mejorJoven === specialResults.mejorJoven) {
    points += SCORING.especiales.mejorJoven;
  }

  if (isSpecialConfigured(specialResults.maxGoleador) && team.specials.maxGoleador === specialResults.maxGoleador) {
    points += SCORING.especiales.maxGoleador;
  }

  if (isSpecialConfigured(specialResults.maxAsistente) && team.specials.maxAsistente === specialResults.maxAsistente) {
    points += SCORING.especiales.maxAsistente;
  }

  if (isSpecialConfigured(specialResults.mejorPortero) && team.specials.mejorPortero === specialResults.mejorPortero) {
    points += SCORING.especiales.mejorPortero;
  }

  if (isSpecialConfigured(specialResults.maxGoleadorEsp) && team.specials.maxGoleadorEsp === specialResults.maxGoleadorEsp) {
    points += SCORING.especiales.maxGoleadorEsp;
  }

  if (isSpecialConfigured(specialResults.primerGolEsp) && team.specials.primerGolEsp === specialResults.primerGolEsp) {
    points += SCORING.especiales.primerGolEsp;
  }

  if (isSpecialConfigured(specialResults.revelacion) && team.specials.revelacion === specialResults.revelacion) {
    points += SCORING.especiales.revelacion;
  }

  if (isSpecialConfigured(specialResults.decepcion) && team.specials.decepcion === specialResults.decepcion) {
    points += SCORING.especiales.decepcion;
  }

  if (
    typeof specialResults.minutoPrimerGol === "number" &&
    team.specials.minutoPrimerGol === specialResults.minutoPrimerGol
  ) {
    points += SCORING.especiales.minutoPrimerGol;
  }

  return points;
}

export function scoreParticipants(participants: Team[], adminResults: AdminResults) {
  const baseTeams = participants.map((participant) => cloneTeam(participant));

  if (!adminResults.configured) {
    baseTeams.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.finalPhasePoints !== a.finalPhasePoints) return b.finalPhasePoints - a.finalPhasePoints;
      if (b.groupPoints !== a.groupPoints) return b.groupPoints - a.groupPoints;
      return a.name.localeCompare(b.name, "es");
    });

    let currentRank = 1;
    baseTeams.forEach((team, index) => {
      if (index > 0 && team.totalPoints < baseTeams[index - 1].totalPoints) {
        currentRank = index + 1;
      }
      team.currentRank = currentRank;
    });

    return baseTeams;
  }

  const scored = baseTeams.map((participant) => {
    const nextTeam = cloneTeam(participant);
    const matchScores = scoreGroupMatchPicks(nextTeam, adminResults);
    const groupPositionPoints = scoreGroupPositions(nextTeam, adminResults);
    const knockout = scoreKnockoutRounds(nextTeam, adminResults);
    const podiumPoints = scorePodium(nextTeam, adminResults);
    const specialPoints = scoreSpecials(nextTeam, adminResults);

    nextTeam.matchPicks = matchScores.matchPicks;
    nextTeam.groupPoints = matchScores.points + groupPositionPoints;
    nextTeam.knockoutPicks = knockout.knockoutPicks;
    nextTeam.finalPhasePoints = knockout.points + podiumPoints;
    nextTeam.specialPoints = specialPoints;
    nextTeam.totalPoints = nextTeam.groupPoints + nextTeam.finalPhasePoints + nextTeam.specialPoints;

    return nextTeam;
  });

  scored.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.finalPhasePoints !== a.finalPhasePoints) return b.finalPhasePoints - a.finalPhasePoints;
    if (b.groupPoints !== a.groupPoints) return b.groupPoints - a.groupPoints;
    return a.name.localeCompare(b.name, "es");
  });

  let currentRank = 1;

  scored.forEach((team, index) => {
    if (index > 0 && team.totalPoints < scored[index - 1].totalPoints) {
      currentRank = index + 1;
    }
    team.currentRank = currentRank;
  });

  return scored;
}
