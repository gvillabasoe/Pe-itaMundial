import { FIXTURES, GROUPS, KNOCKOUT_ROUND_DEFS, type MatchPick, type SpecialPicks, type Team } from "@/lib/data";
import type { KnockoutRoundKey } from "@/lib/admin-results";

export type DraftScoreValue = "" | number;

export interface DraftMatchPick {
  home: DraftScoreValue;
  away: DraftScoreValue;
}

export interface DraftSpecialPicks extends Omit<SpecialPicks, "minutoPrimerGol"> {
  minutoPrimerGol: string;
}

export interface PorraDraft {
  id: string;
  userId: string;
  username: string;
  teamName: string;
  matchPicks: Record<string, DraftMatchPick>;
  doubleMatches: Record<string, string[]>;
  groupOrderPicks: Record<string, string[]>;
  bestThirdGroups: string[];
  bestThirdAssignments: Record<string, string>;
  roundWinners: {
    round32: Record<string, string>;
    round16: Record<string, string>;
    quarter: Record<string, string>;
    semi: Record<string, string>;
  };
  championPick: string;
  runnerUpPick: string;
  thirdPlacePick: string;
  specials: DraftSpecialPicks;
}

type GroupPositionSlot = {
  kind: "group-position";
  group: string;
  position: 1 | 2;
  label: string;
};

type BestThirdSlot = {
  kind: "best-third";
  eligibleGroups: string[];
  label: string;
};

type Round32Slot = GroupPositionSlot | BestThirdSlot;

export interface Round32MatchDef {
  matchId: string;
  home: Round32Slot;
  away: Round32Slot;
}

export interface BracketMatchView {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeLabel: string;
  awayLabel: string;
  winner: string;
}

const GROUP_FIXTURES = Object.keys(GROUPS).reduce<Record<string, typeof FIXTURES>>((acc, group) => {
  acc[group] = FIXTURES.filter((fixture) => fixture.group === group);
  return acc;
}, {} as Record<string, typeof FIXTURES>);

export const ROUND32_MATCH_DEFS: Round32MatchDef[] = [
  {
    matchId: "73",
    home: { kind: "group-position", group: "A", position: 2, label: "2A" },
    away: { kind: "group-position", group: "B", position: 2, label: "2B" },
  },
  {
    matchId: "74",
    home: { kind: "group-position", group: "E", position: 1, label: "1E" },
    away: { kind: "best-third", eligibleGroups: ["A", "B", "C", "D", "F"], label: "3ABCDF" },
  },
  {
    matchId: "75",
    home: { kind: "group-position", group: "F", position: 1, label: "1F" },
    away: { kind: "group-position", group: "C", position: 2, label: "2C" },
  },
  {
    matchId: "76",
    home: { kind: "group-position", group: "C", position: 1, label: "1C" },
    away: { kind: "group-position", group: "F", position: 2, label: "2F" },
  },
  {
    matchId: "77",
    home: { kind: "group-position", group: "I", position: 1, label: "1I" },
    away: { kind: "best-third", eligibleGroups: ["C", "D", "F", "G", "H"], label: "3CDFGH" },
  },
  {
    matchId: "78",
    home: { kind: "group-position", group: "E", position: 2, label: "2E" },
    away: { kind: "group-position", group: "I", position: 2, label: "2I" },
  },
  {
    matchId: "79",
    home: { kind: "group-position", group: "A", position: 1, label: "1A" },
    away: { kind: "best-third", eligibleGroups: ["C", "E", "F", "H", "I"], label: "3CEFHI" },
  },
  {
    matchId: "80",
    home: { kind: "group-position", group: "L", position: 1, label: "1L" },
    away: { kind: "best-third", eligibleGroups: ["E", "H", "I", "J", "K"], label: "3EHIJK" },
  },
  {
    matchId: "81",
    home: { kind: "group-position", group: "D", position: 1, label: "1D" },
    away: { kind: "best-third", eligibleGroups: ["B", "E", "F", "I", "J"], label: "3BEFIJ" },
  },
  {
    matchId: "82",
    home: { kind: "group-position", group: "G", position: 1, label: "1G" },
    away: { kind: "best-third", eligibleGroups: ["A", "E", "H", "I", "J"], label: "3AEHIJ" },
  },
  {
    matchId: "83",
    home: { kind: "group-position", group: "K", position: 2, label: "2K" },
    away: { kind: "group-position", group: "L", position: 2, label: "2L" },
  },
  {
    matchId: "84",
    home: { kind: "group-position", group: "H", position: 1, label: "1H" },
    away: { kind: "group-position", group: "J", position: 2, label: "2J" },
  },
  {
    matchId: "85",
    home: { kind: "group-position", group: "B", position: 1, label: "1B" },
    away: { kind: "best-third", eligibleGroups: ["E", "F", "G", "I", "J"], label: "3EFGIJ" },
  },
  {
    matchId: "86",
    home: { kind: "group-position", group: "J", position: 1, label: "1J" },
    away: { kind: "group-position", group: "H", position: 2, label: "2H" },
  },
  {
    matchId: "87",
    home: { kind: "group-position", group: "K", position: 1, label: "1K" },
    away: { kind: "best-third", eligibleGroups: ["D", "E", "I", "J", "L"], label: "3DEIJL" },
  },
  {
    matchId: "88",
    home: { kind: "group-position", group: "D", position: 2, label: "2D" },
    away: { kind: "group-position", group: "G", position: 2, label: "2G" },
  },
];

export const ROUND16_MATCH_DEFS = [
  { matchId: "89", homeFrom: "74", awayFrom: "77" },
  { matchId: "90", homeFrom: "73", awayFrom: "75" },
  { matchId: "91", homeFrom: "76", awayFrom: "78" },
  { matchId: "92", homeFrom: "79", awayFrom: "80" },
  { matchId: "93", homeFrom: "83", awayFrom: "84" },
  { matchId: "94", homeFrom: "81", awayFrom: "82" },
  { matchId: "95", homeFrom: "86", awayFrom: "88" },
  { matchId: "96", homeFrom: "85", awayFrom: "87" },
] as const;

export const QUARTER_MATCH_DEFS = [
  { matchId: "97", homeFrom: "89", awayFrom: "90" },
  { matchId: "98", homeFrom: "93", awayFrom: "94" },
  { matchId: "99", homeFrom: "91", awayFrom: "92" },
  { matchId: "100", homeFrom: "95", awayFrom: "96" },
] as const;

export const SEMI_MATCH_DEFS = [
  { matchId: "101", homeFrom: "97", awayFrom: "98" },
  { matchId: "102", homeFrom: "99", awayFrom: "100" },
] as const;

export const FINAL_MATCH_DEF = { matchId: "104", homeFrom: "101", awayFrom: "102" } as const;
export const BEST_THIRD_MATCH_IDS = ROUND32_MATCH_DEFS.filter(
  (match) => match.home.kind === "best-third" || match.away.kind === "best-third"
).map((match) => match.matchId);

export function createEmptyPorraDraft(userId: string, username: string): PorraDraft {
  return {
    id: `team-${userId}-${Date.now()}`,
    userId,
    username,
    teamName: "",
    matchPicks: Object.fromEntries(
      FIXTURES.map((fixture) => [fixture.id, { home: "", away: "" }])
    ),
    doubleMatches: Object.fromEntries(Object.keys(GROUPS).map((group) => [group, []])),
    groupOrderPicks: Object.fromEntries(Object.entries(GROUPS).map(([group]) => [group, ["", "", "", ""]])),
    bestThirdGroups: [],
    bestThirdAssignments: {},
    roundWinners: {
      round32: {},
      round16: {},
      quarter: {},
      semi: {},
    },
    championPick: "",
    runnerUpPick: "",
    thirdPlacePick: "",
    specials: {
      mejorJugador: "",
      mejorJoven: "",
      maxGoleador: "",
      maxAsistente: "",
      mejorPortero: "",
      maxGoleadorEsp: "",
      primerGolEsp: "",
      revelacion: "",
      decepcion: "",
      minutoPrimerGol: "",
    },
  };
}

export function getGroupFixtures(group: string) {
  return GROUP_FIXTURES[group] || [];
}

export function getGroupTeamAtPosition(draft: PorraDraft, group: string, position: 1 | 2 | 3 | 4) {
  return draft.groupOrderPicks[group]?.[position - 1] || "";
}

export function getThirdPlaceTeamsByGroup(draft: PorraDraft) {
  return Object.fromEntries(Object.keys(GROUPS).map((group) => [group, getGroupTeamAtPosition(draft, group, 3)])) as Record<string, string>;
}

export function getSelectedBestThirdTeams(draft: PorraDraft) {
  const thirds = getThirdPlaceTeamsByGroup(draft);
  return draft.bestThirdGroups
    .map((group) => ({ group, team: thirds[group] || "" }))
    .filter((item) => Boolean(item.team));
}

function resolveRound32Slot(slot: Round32Slot, draft: PorraDraft, matchId: string) {
  if (slot.kind === "group-position") {
    return getGroupTeamAtPosition(draft, slot.group, slot.position);
  }

  const assigned = draft.bestThirdAssignments[matchId];
  return assigned || "";
}

export function getEligibleBestThirdTeams(matchId: string, draft: PorraDraft) {
  const definition = ROUND32_MATCH_DEFS.find((match) => match.matchId === matchId);
  if (!definition) return [];

  const thirdTeams = getThirdPlaceTeamsByGroup(draft);
  const slot = definition.home.kind === "best-third" ? definition.home : definition.away.kind === "best-third" ? definition.away : null;
  if (!slot || slot.kind !== "best-third") return [];

  return slot.eligibleGroups
    .filter((group) => draft.bestThirdGroups.includes(group))
    .map((group) => thirdTeams[group])
    .filter(Boolean);
}

function getValidWinner(selected: string, homeTeam: string, awayTeam: string) {
  if (selected && (selected === homeTeam || selected === awayTeam)) {
    return selected;
  }
  return "";
}

export function getRound32Matches(draft: PorraDraft): BracketMatchView[] {
  return ROUND32_MATCH_DEFS.map((match) => {
    const homeTeam = resolveRound32Slot(match.home, draft, match.matchId);
    const awayTeam = resolveRound32Slot(match.away, draft, match.matchId);
    return {
      matchId: match.matchId,
      homeTeam,
      awayTeam,
      homeLabel: match.home.label,
      awayLabel: match.away.label,
      winner: getValidWinner(draft.roundWinners.round32[match.matchId] || "", homeTeam, awayTeam),
    };
  });
}

function buildBracketFromPreviousRound(
  definitions: ReadonlyArray<{ matchId: string; homeFrom: string; awayFrom: string }>,
  previousWinners: Record<string, string>,
  selectedWinners: Record<string, string>
): BracketMatchView[] {
  return definitions.map((definition) => {
    const homeTeam = previousWinners[definition.homeFrom] || "";
    const awayTeam = previousWinners[definition.awayFrom] || "";
    return {
      matchId: definition.matchId,
      homeTeam,
      awayTeam,
      homeLabel: `G${definition.homeFrom}`,
      awayLabel: `G${definition.awayFrom}`,
      winner: getValidWinner(selectedWinners[definition.matchId] || "", homeTeam, awayTeam),
    };
  });
}

export function getRound16Matches(draft: PorraDraft) {
  const previous = Object.fromEntries(getRound32Matches(draft).map((match) => [match.matchId, match.winner]));
  return buildBracketFromPreviousRound(ROUND16_MATCH_DEFS, previous, draft.roundWinners.round16);
}

export function getQuarterMatches(draft: PorraDraft) {
  const previous = Object.fromEntries(getRound16Matches(draft).map((match) => [match.matchId, match.winner]));
  return buildBracketFromPreviousRound(QUARTER_MATCH_DEFS, previous, draft.roundWinners.quarter);
}

export function getSemiMatches(draft: PorraDraft) {
  const previous = Object.fromEntries(getQuarterMatches(draft).map((match) => [match.matchId, match.winner]));
  return buildBracketFromPreviousRound(SEMI_MATCH_DEFS, previous, draft.roundWinners.semi);
}

export function getFinalParticipants(draft: PorraDraft) {
  const previous = Object.fromEntries(getSemiMatches(draft).map((match) => [match.matchId, match.winner]));
  const homeTeam = previous[FINAL_MATCH_DEF.homeFrom] || "";
  const awayTeam = previous[FINAL_MATCH_DEF.awayFrom] || "";
  return {
    matchId: FINAL_MATCH_DEF.matchId,
    homeTeam,
    awayTeam,
    homeLabel: `G${FINAL_MATCH_DEF.homeFrom}`,
    awayLabel: `G${FINAL_MATCH_DEF.awayFrom}`,
  };
}

export function getThirdPlaceParticipants(draft: PorraDraft) {
  const quarterMatches = Object.fromEntries(getQuarterMatches(draft).map((match) => [match.matchId, match]));
  const semiMatches = getSemiMatches(draft);

  const losers = semiMatches.map((match, index) => {
    const winner = match.winner;
    const loser = winner && winner === match.homeTeam ? match.awayTeam : winner && winner === match.awayTeam ? match.homeTeam : "";
    return {
      matchId: index === 0 ? "103a" : "103b",
      team: loser,
    };
  });

  return losers.map((item) => item.team).filter(Boolean);
}

export function computeRoundOf32Teams(draft: PorraDraft) {
  const teams: string[] = [];
  getRound32Matches(draft).forEach((match) => {
    teams.push(match.homeTeam || "");
    teams.push(match.awayTeam || "");
  });
  return teams;
}

function buildKnockoutPicks(roundKey: KnockoutRoundKey, teams: string[]) {
  const required = KNOCKOUT_ROUND_DEFS.find((round) => round.key === roundKey)?.count || teams.length;
  const values = teams.slice(0, required);
  while (values.length < required) values.push("");
  return values.map((team) => ({ country: team, points: null, status: "pending" as const }));
}

function parseDraftScore(value: DraftScoreValue) {
  if (value === "" || value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.floor(numeric);
}

export function validatePorraDraft(draft: PorraDraft) {
  const errors: string[] = [];

  if (!draft.teamName.trim()) {
    errors.push("Añade el nombre de la porra.");
  }

  Object.entries(GROUPS).forEach(([group]) => {
    const fixtures = getGroupFixtures(group);
    const allScoresCompleted = fixtures.every((fixture) => {
      const pick = draft.matchPicks[fixture.id];
      return parseDraftScore(pick?.home) !== null && parseDraftScore(pick?.away) !== null;
    });

    if (!allScoresCompleted) {
      errors.push(`Completa todos los marcadores del Grupo ${group}.`);
    }

    const doubles = draft.doubleMatches[group] || [];
    if (doubles.length !== 1) {
      errors.push(
        doubles.length > 1
          ? `Solo puedes marcar 1 partido doble en el Grupo ${group}.`
          : `Selecciona el partido doble del Grupo ${group}.`
      );
    }

    const picks = draft.groupOrderPicks[group] || [];
    if (picks.length !== 4 || picks.some((value) => !value) || new Set(picks).size !== 4) {
      errors.push(`Define las 4 posiciones del Grupo ${group} sin repetir equipos.`);
    }
  });

  const selectedBestThirdTeams = getSelectedBestThirdTeams(draft);
  if (selectedBestThirdTeams.length !== 8 || new Set(draft.bestThirdGroups).size !== 8) {
    errors.push("Selecciona exactamente 8 mejores terceros.");
  }

  const assignedBestThirds = BEST_THIRD_MATCH_IDS.map((matchId) => draft.bestThirdAssignments[matchId] || "").filter(Boolean);
  if (assignedBestThirds.length !== BEST_THIRD_MATCH_IDS.length) {
    errors.push("Asigna un mejor tercero en todos los cruces que lo requieren.");
  }
  if (new Set(assignedBestThirds).size !== assignedBestThirds.length) {
    errors.push("No puedes asignar el mismo mejor tercero dos veces.");
  }

  getRound32Matches(draft).forEach((match) => {
    if (!match.homeTeam || !match.awayTeam || !match.winner) {
      errors.push(`Completa el clasificado del partido ${match.matchId} de dieciseisavos.`);
    }
  });

  getRound16Matches(draft).forEach((match) => {
    if (!match.homeTeam || !match.awayTeam || !match.winner) {
      errors.push(`Completa el clasificado del partido ${match.matchId} de octavos.`);
    }
  });

  getQuarterMatches(draft).forEach((match) => {
    if (!match.homeTeam || !match.awayTeam || !match.winner) {
      errors.push(`Completa el clasificado del partido ${match.matchId} de cuartos.`);
    }
  });

  getSemiMatches(draft).forEach((match) => {
    if (!match.homeTeam || !match.awayTeam || !match.winner) {
      errors.push(`Completa el clasificado del partido ${match.matchId} de semifinales.`);
    }
  });

  const podium = [draft.championPick, draft.runnerUpPick, draft.thirdPlacePick].filter(Boolean);
  if (podium.length !== 3 || new Set(podium).size !== 3) {
    errors.push("Define campeón, subcampeón y tercer puesto sin repetir selecciones.");
  }

  const specials = draft.specials;
  const missingSpecial = [
    specials.mejorJugador,
    specials.mejorJoven,
    specials.maxGoleador,
    specials.maxAsistente,
    specials.mejorPortero,
    specials.maxGoleadorEsp,
    specials.primerGolEsp,
    specials.revelacion,
    specials.decepcion,
    specials.minutoPrimerGol,
  ].some((value) => String(value ?? "").trim() === "");

  if (missingSpecial) {
    errors.push("Completa todos los especiales antes de guardar.");
  }

  const minute = Number(specials.minutoPrimerGol);
  if (!Number.isFinite(minute) || minute < 0) {
    errors.push("Introduce un minuto válido para el primer gol.");
  }

  return Array.from(new Set(errors));
}

export function buildStoredTeamFromDraft(draft: PorraDraft): Team {
  const round32Matches = getRound32Matches(draft);
  const round16Matches = getRound16Matches(draft);
  const quarterMatches = getQuarterMatches(draft);
  const semiMatches = getSemiMatches(draft);
  const finalParticipants = getFinalParticipants(draft);

  const matchPicks = Object.fromEntries(
    FIXTURES.map((fixture) => {
      const pick = draft.matchPicks[fixture.id];
      return [
        fixture.id,
        {
          home: parseDraftScore(pick?.home) ?? 0,
          away: parseDraftScore(pick?.away) ?? 0,
          points: null,
          status: "pending" as const,
        },
      ];
    })
  ) as Record<string, MatchPick>;

  const doubleMatches = Object.fromEntries(
    Object.keys(GROUPS).map((group) => [group, draft.doubleMatches[group]?.[0] || ""])
  );

  const knockoutPicks = {
    dieciseisavos: buildKnockoutPicks("dieciseisavos", round32Matches.map((match) => match.winner)),
    octavos: buildKnockoutPicks("octavos", round16Matches.map((match) => match.winner)),
    cuartos: buildKnockoutPicks("cuartos", quarterMatches.map((match) => match.winner)),
    semis: buildKnockoutPicks("semis", semiMatches.map((match) => match.winner)),
    final: buildKnockoutPicks("final", [finalParticipants.homeTeam, finalParticipants.awayTeam]),
  } as Record<KnockoutRoundKey, ReturnType<typeof buildKnockoutPicks>>;

  return {
    id: draft.id,
    name: draft.teamName.trim(),
    userId: draft.userId,
    username: draft.username,
    championPick: draft.championPick,
    runnerUpPick: draft.runnerUpPick,
    thirdPlacePick: draft.thirdPlacePick,
    totalPoints: 0,
    groupPoints: 0,
    finalPhasePoints: 0,
    specialPoints: 0,
    currentRank: 0,
    matchPicks,
    doubleMatches,
    knockoutPicks,
    groupOrderPicks: Object.fromEntries(Object.entries(draft.groupOrderPicks).map(([group, values]) => [group, [...values]])),
    specials: {
      ...draft.specials,
      minutoPrimerGol: Math.floor(Number(draft.specials.minutoPrimerGol || 0)),
    },
    roundOf32Teams: computeRoundOf32Teams(draft),
    bestThirdGroups: [...draft.bestThirdGroups],
    bestThirdAssignments: { ...draft.bestThirdAssignments },
    createdAt: new Date().toISOString(),
    locked: true,
    source: "user",
  };
}
