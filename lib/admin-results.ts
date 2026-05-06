import { GROUPS, KNOCKOUT_ROUND_DEFS } from "@/lib/data";
import { WORLD_CUP_MATCHES } from "@/lib/worldcup/schedule";

export const ADMIN_RESULTS_VERSION = 2;

export type KnockoutRoundKey = (typeof KNOCKOUT_ROUND_DEFS)[number]["key"];
export type GroupPositionValue = 0 | 1 | 2 | 3 | 4;

export interface AdminPodiumResults {
  campeon: string;
  subcampeon: string;
  tercero: string;
}

export interface AdminSpecialResults {
  mejorJugador: string;
  mejorJoven: string;
  maxGoleador: string;
  maxAsistente: string;
  mejorPortero: string;
  maxGoleadorEsp: string;
  primerGolEsp: string;
  revelacion: string;
  decepcion: string;
  minutoPrimerGol: number | null;
}

export interface AdminMatchResult {
  home: number | null;
  away: number | null;
  statusShort: "NS" | "FT";
}

export interface AdminResults {
  version: number;
  configured: boolean;
  savedAt: string | null;
  matchResults: Record<string, AdminMatchResult>;
  groupPositions: Record<string, GroupPositionValue>;
  knockoutRounds: Record<KnockoutRoundKey, string[]>;
  podium: AdminPodiumResults;
  specialResults: AdminSpecialResults;
}

export const ALL_TEAMS = Object.values(GROUPS).flat();
export const ALL_TEAMS_SORTED = [...ALL_TEAMS].sort((a, b) => a.localeCompare(b, "es"));
export const TEAM_SET = new Set(ALL_TEAMS);
export const WORLD_CUP_MATCH_IDS = WORLD_CUP_MATCHES.map((match) => String(match.id));

// ── Counts para el USUARIO (cuántos equipos elige en su porra) ──
// dieciseisavos=16, octavos=8, cuartos=4, semis=2, final=2
export const KNOCKOUT_COUNTS: Record<KnockoutRoundKey, number> = KNOCKOUT_ROUND_DEFS.reduce(
  (acc, round) => { acc[round.key] = round.count; return acc; },
  {} as Record<KnockoutRoundKey, number>
);

// ── Counts para el ADMIN (todos los equipos participantes en cada ronda) ──
// dieciseisavos=32, octavos=16, cuartos=8, semis=4, final=2
// Hardcodeado para no necesitar modificar lib/data.ts con un campo adminCount.
const ADMIN_ROUND_SLOT_COUNTS: Record<string, number> = {
  dieciseisavos: 32,
  octavos: 16,
  cuartos: 8,
  semis: 4,
  final: 2,
};

export const KNOCKOUT_ADMIN_COUNTS: Record<KnockoutRoundKey, number> = KNOCKOUT_ROUND_DEFS.reduce(
  (acc, round) => {
    acc[round.key] = ADMIN_ROUND_SLOT_COUNTS[round.key] ?? round.count;
    return acc;
  },
  {} as Record<KnockoutRoundKey, number>
);

export const KNOCKOUT_LABELS: Record<KnockoutRoundKey, string> = KNOCKOUT_ROUND_DEFS.reduce(
  (acc, round) => { acc[round.key] = round.name; return acc; },
  {} as Record<KnockoutRoundKey, string>
);

export const ADMIN_SPECIAL_FIELDS = [
  { key: "mejorJugador", label: "Mejor Jugador", kind: "text" },
  { key: "mejorJoven", label: "Mejor Jugador Joven", kind: "text" },
  { key: "mejorPortero", label: "Mejor Portero", kind: "text" },
  { key: "maxGoleador", label: "Máximo Goleador", kind: "text" },
  { key: "maxAsistente", label: "Máximo Asistente", kind: "text" },
  { key: "maxGoleadorEsp", label: "Máximo Goleador Español", kind: "text" },
  { key: "primerGolEsp", label: "Primer Goleador Español", kind: "text" },
  { key: "revelacion", label: "Selección Revelación", kind: "team" },
  { key: "decepcion", label: "Selección Decepción", kind: "team" },
  { key: "minutoPrimerGol", label: "Minuto Primer Gol", kind: "number" },
] as const;

function cleanTeam(value: unknown) {
  const team = String(value ?? "").trim();
  return TEAM_SET.has(team) ? team : "";
}
function cleanText(value: unknown) { return String(value ?? "").trim(); }
function cleanPosition(value: unknown): GroupPositionValue {
  const n = Number(value);
  return (n === 1 || n === 2 || n === 3 || n === 4) ? n : 0;
}
function cleanMinute(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}
function cleanScore(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function sanitizeMatchResult(value: Partial<AdminMatchResult> | null | undefined): AdminMatchResult {
  const home = cleanScore(value?.home);
  const away = cleanScore(value?.away);
  if (home === null || away === null) return { home: null, away: null, statusShort: "NS" };
  return { home, away, statusShort: "FT" };
}

// Usa KNOCKOUT_ADMIN_COUNTS para crear arrays con el tamaño correcto (32/16/8/4)
function normalizeRoundValues(roundKey: KnockoutRoundKey, values: unknown) {
  const count = KNOCKOUT_ADMIN_COUNTS[roundKey];
  const requested = Array.isArray(values) ? values : [];
  const used = new Set<string>();
  const next = requested.slice(0, count).map((value) => {
    const team = cleanTeam(value);
    if (!team || used.has(team)) return "";
    used.add(team);
    return team;
  });
  while (next.length < count) next.push("");
  return next;
}

export function createDefaultAdminResults(): AdminResults {
  return {
    version: ADMIN_RESULTS_VERSION,
    configured: false,
    savedAt: null,
    matchResults: WORLD_CUP_MATCH_IDS.reduce(
      (acc, matchId) => { acc[matchId] = { home: null, away: null, statusShort: "NS" }; return acc; },
      {} as Record<string, AdminMatchResult>
    ),
    groupPositions: ALL_TEAMS.reduce(
      (acc, team) => { acc[team] = 0; return acc; },
      {} as Record<string, GroupPositionValue>
    ),
    // ← KNOCKOUT_ADMIN_COUNTS: 32 slots para dieciseisavos, 16 para octavos, etc.
    knockoutRounds: KNOCKOUT_ROUND_DEFS.reduce(
      (acc, round) => {
        acc[round.key] = Array.from({ length: KNOCKOUT_ADMIN_COUNTS[round.key] }, () => "");
        return acc;
      },
      {} as Record<KnockoutRoundKey, string[]>
    ),
    podium: { campeon: "", subcampeon: "", tercero: "" },
    specialResults: {
      mejorJugador: "", mejorJoven: "", maxGoleador: "", maxAsistente: "",
      mejorPortero: "", maxGoleadorEsp: "", primerGolEsp: "",
      revelacion: "", decepcion: "", minutoPrimerGol: null,
    },
  };
}

export function isConfiguredMatchResult(value?: AdminMatchResult | null): boolean {
  return typeof value?.home === "number" && typeof value?.away === "number";
}

export function hasConfiguredAdminResults(value: AdminResults): boolean {
  if (value.configured) return true;
  if (Object.values(value.matchResults).some(isConfiguredMatchResult)) return true;
  if (Object.values(value.groupPositions).some((position) => position > 0)) return true;
  if (Object.values(value.knockoutRounds).some((round) => round.some(Boolean))) return true;
  if (value.podium.campeon || value.podium.subcampeon || value.podium.tercero) return true;
  return Object.entries(value.specialResults).some(([key, result]) =>
    key === "minutoPrimerGol" ? result !== null && result !== undefined : String(result ?? "").trim() !== ""
  );
}

export function sanitizeAdminResults(value: unknown): AdminResults {
  const defaults = createDefaultAdminResults();
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  const matchResults: Record<string, AdminMatchResult> = {};
  const rawMatchResults = raw.matchResults && typeof raw.matchResults === "object"
    ? (raw.matchResults as Record<string, unknown>) : {};
  for (const matchId of WORLD_CUP_MATCH_IDS) {
    const existing = rawMatchResults[matchId];
    matchResults[matchId] = sanitizeMatchResult(
      existing && typeof existing === "object" ? (existing as Partial<AdminMatchResult>) : undefined
    );
  }

  const groupPositions: Record<string, GroupPositionValue> = {};
  const rawGroupPositions = raw.groupPositions && typeof raw.groupPositions === "object"
    ? (raw.groupPositions as Record<string, unknown>) : {};
  for (const team of ALL_TEAMS) groupPositions[team] = cleanPosition(rawGroupPositions[team]);

  const knockoutRounds: Record<KnockoutRoundKey, string[]> = {} as Record<KnockoutRoundKey, string[]>;
  const rawKnockoutRounds = raw.knockoutRounds && typeof raw.knockoutRounds === "object"
    ? (raw.knockoutRounds as Record<string, unknown>) : {};
  for (const round of KNOCKOUT_ROUND_DEFS) {
    knockoutRounds[round.key] = normalizeRoundValues(round.key, rawKnockoutRounds[round.key]);
  }

  const rawPodium = raw.podium && typeof raw.podium === "object"
    ? (raw.podium as Record<string, unknown>) : {};
  const rawSpecials = raw.specialResults && typeof raw.specialResults === "object"
    ? (raw.specialResults as Record<string, unknown>) : {};

  const sanitized: AdminResults = {
    version: ADMIN_RESULTS_VERSION,
    configured: Boolean(raw.configured),
    savedAt: typeof raw.savedAt === "string" && raw.savedAt ? raw.savedAt : defaults.savedAt,
    matchResults,
    groupPositions,
    knockoutRounds,
    podium: {
      campeon: cleanTeam(rawPodium.campeon),
      subcampeon: cleanTeam(rawPodium.subcampeon),
      tercero: cleanTeam(rawPodium.tercero),
    },
    specialResults: {
      mejorJugador: cleanText(rawSpecials.mejorJugador),
      mejorJoven: cleanText(rawSpecials.mejorJoven),
      maxGoleador: cleanText(rawSpecials.maxGoleador),
      maxAsistente: cleanText(rawSpecials.maxAsistente),
      mejorPortero: cleanText(rawSpecials.mejorPortero),
      maxGoleadorEsp: cleanText(rawSpecials.maxGoleadorEsp),
      primerGolEsp: cleanText(rawSpecials.primerGolEsp),
      revelacion: cleanTeam(rawSpecials.revelacion),
      decepcion: cleanTeam(rawSpecials.decepcion),
      minutoPrimerGol: cleanMinute(rawSpecials.minutoPrimerGol),
    },
  };

  sanitized.configured = hasConfiguredAdminResults(sanitized);
  return sanitized;
}

export function formatAdminSavedAt(savedAt: string | null | undefined): string {
  if (!savedAt) return "Sin guardar";
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return "Sin guardar";
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(date);
}
