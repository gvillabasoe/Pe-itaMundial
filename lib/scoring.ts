import { GROUPS, KNOCKOUT_ROUND_DEFS, SCORING, type KnockoutPick, type MatchPick, type Team } from "@/lib/data";
import type { AdminResults, KnockoutRoundKey } from "@/lib/admin-results";

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
  if (!adminResults.configured) {
    return participants.map((participant) => cloneTeam(participant));
  }

  const scored = participants.map((participant) => {
    const nextTeam = cloneTeam(participant);
    const groupPoints = scoreGroupPositions(nextTeam, adminResults);
    const knockout = scoreKnockoutRounds(nextTeam, adminResults);
    const podiumPoints = scorePodium(nextTeam, adminResults);
    const specialPoints = scoreSpecials(nextTeam, adminResults);

    nextTeam.groupPoints = groupPoints;
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
