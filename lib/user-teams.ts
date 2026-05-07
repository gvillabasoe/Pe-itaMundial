import { FIXTURES, GROUPS, KNOCKOUT_ROUND_DEFS, type KnockoutPick, type MatchPick, type SpecialPicks, type Team } from "@/lib/data";
import { ALL_TEAMS_SORTED, TEAM_SET } from "@/lib/admin-results";

export const USER_TEAMS_VERSION = 1;

export interface UserTeamsStore {
  version: number;
  savedAt: string | null;
  entries: Team[];
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function cleanUsername(value: unknown) {
  const raw = cleanText(value);
  if (!raw) return "";
  return raw.startsWith("@") ? raw.slice(1) : raw;
}

function cleanTeam(value: unknown) {
  const team = cleanText(value);
  return TEAM_SET.has(team) ? team : "";
}

function cleanInteger(value: unknown, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Math.floor(numeric);
}

function cleanNullableInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.floor(numeric);
}

function sanitizeMatchPick(value: Partial<MatchPick> | null | undefined): MatchPick {
  const home = cleanNullableInteger(value?.home);
  const away = cleanNullableInteger(value?.away);
  const hasScore = typeof home === "number" && typeof away === "number";

  return {
    home,
    away,
    points: hasScore && typeof value?.points === "number" ? Math.floor(value.points) : null,
    status:
      hasScore && (value?.status === "correct" || value?.status === "sign" || value?.status === "wrong")
        ? value.status
        : "pending",
  };
}

function sanitizeKnockoutPick(value: Partial<KnockoutPick> | null | undefined): KnockoutPick {
  return {
    country: cleanTeam(value?.country),
    points: typeof value?.points === "number" ? Math.floor(value.points) : null,
    status: value?.status === "correct" || value?.status === "wrong" ? value.status : "pending",
  };
}

function sanitizeSpecials(value: Partial<SpecialPicks> | null | undefined): SpecialPicks {
  return {
    mejorJugador: cleanText(value?.mejorJugador),
    mejorJoven: cleanText(value?.mejorJoven),
    maxGoleador: cleanText(value?.maxGoleador),
    maxAsistente: cleanText(value?.maxAsistente),
    mejorPortero: cleanText(value?.mejorPortero),
    maxGoleadorEsp: cleanText(value?.maxGoleadorEsp),
    primerGolEsp: cleanText(value?.primerGolEsp),
    revelacion: cleanTeam(value?.revelacion),
    decepcion: cleanTeam(value?.decepcion),
    minutoPrimerGol: cleanInteger(value?.minutoPrimerGol, 0),
  };
}

function sanitizeGroupOrder(group: string, values: unknown) {
  const raw = Array.isArray(values) ? values.slice(0, 4) : [];
  const used = new Set<string>();
  const next = raw.map((value) => {
    const team = cleanTeam(value);
    if (!team || !GROUPS[group].includes(team) || used.has(team)) return "";
    used.add(team);
    return team;
  });

  while (next.length < 4) next.push("");
  return next;
}

function sanitizeRoundOf32Teams(values: unknown) {
  const raw = Array.isArray(values) ? values.slice(0, 32) : [];
  const next = raw.map((value) => cleanTeam(value));
  while (next.length < 32) next.push("");
  return next;
}

function sanitizeBestThirdGroups(values: unknown) {
  if (!Array.isArray(values)) return [] as string[];
  const used = new Set<string>();
  return values
    .map((value) => cleanText(value).toUpperCase())
    .filter((value) => Object.prototype.hasOwnProperty.call(GROUPS, value) && !used.has(value) && used.add(value));
}

function sanitizeBestThirdAssignments(values: unknown) {
  if (!values || typeof values !== "object") return {} as Record<string, string>;
  return Object.fromEntries(
    Object.entries(values as Record<string, unknown>).map(([key, value]) => [String(key), cleanTeam(value)])
  );
}

export function createEmptyUserTeamsStore(): UserTeamsStore {
  return {
    version: USER_TEAMS_VERSION,
    savedAt: null,
    entries: [],
  };
}

export function sanitizeUserTeam(input: Partial<Team> | null | undefined): Team | null {
  const current = input || {};
  const name = cleanText(current.name);
  const userId = cleanText(current.userId);
  const username = cleanUsername(current.username);

  if (!name || !userId || !username) return null;

  const matchPicks = Object.fromEntries(
    FIXTURES.map((fixture) => [fixture.id, sanitizeMatchPick(current.matchPicks?.[fixture.id])])
  );

  const doubleMatches = Object.fromEntries(
    Object.keys(GROUPS).map((group) => {
      const value = cleanText(current.doubleMatches?.[group]);
      const fixtureIds = FIXTURES.filter((fixture) => fixture.group === group).map((fixture) => fixture.id);
      return [group, fixtureIds.includes(value) ? value : ""];
    })
  );

  const knockoutPicks = Object.fromEntries(
    KNOCKOUT_ROUND_DEFS.map((round) => {
      const raw = Array.isArray(current.knockoutPicks?.[round.key]) ? current.knockoutPicks?.[round.key] || [] : [];
      const next = raw.slice(0, round.count).map((pick) => sanitizeKnockoutPick(pick));
      while (next.length < round.count) {
        next.push({ country: "", points: null, status: "pending" });
      }
      return [round.key, next];
    })
  ) as Record<string, KnockoutPick[]>;

  const groupOrderPicks = Object.fromEntries(
    Object.keys(GROUPS).map((group) => [group, sanitizeGroupOrder(group, current.groupOrderPicks?.[group])])
  );

  return {
    id: cleanText(current.id) || `${userId}-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    userId,
    username,
    championPick: cleanTeam(current.championPick),
    runnerUpPick: cleanTeam(current.runnerUpPick),
    thirdPlacePick: cleanTeam(current.thirdPlacePick),
    totalPoints: cleanInteger(current.totalPoints, 0),
    groupPoints: cleanInteger(current.groupPoints, 0),
    finalPhasePoints: cleanInteger(current.finalPhasePoints, 0),
    specialPoints: cleanInteger(current.specialPoints, 0),
    currentRank: cleanInteger(current.currentRank, 0),
    matchPicks,
    doubleMatches,
    knockoutPicks,
    groupOrderPicks,
    specials: sanitizeSpecials(current.specials),
    roundOf32Teams: sanitizeRoundOf32Teams(current.roundOf32Teams),
    bestThirdGroups: sanitizeBestThirdGroups(current.bestThirdGroups),
    bestThirdAssignments: sanitizeBestThirdAssignments(current.bestThirdAssignments),
    createdAt: current.createdAt ? String(current.createdAt) : undefined,
    locked: current.locked !== false,
    source: "user",
  };
}

export function sanitizeUserTeamsStore(input: Partial<UserTeamsStore> | null | undefined): UserTeamsStore {
  const current = input || {};
  const entries = Array.isArray(current.entries)
    ? current.entries
        .map((entry) => sanitizeUserTeam(entry))
        .filter((entry): entry is Team => Boolean(entry))
    : [];

  return {
    version: USER_TEAMS_VERSION,
    savedAt: current.savedAt ? String(current.savedAt) : null,
    entries,
  };
}

export function hasRealUserTeams(store: UserTeamsStore) {
  return store.entries.length > 0;
}

export const USER_TEAM_NAMES = ALL_TEAMS_SORTED;
