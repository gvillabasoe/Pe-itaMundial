import { GROUPS, KNOCKOUT_ROUND_DEFS } from "@/lib/data";

export const ADMIN_RESULTS_VERSION = 1;

export type KnockoutRoundKey = (typeof KNOCKOUT_ROUND_DEFS)[number]["key"];
export type GroupPositionValue = 0 | 1 | 2 | 3 | 4;

export interface AdminPodiumResults {
  campeon: string;
  subcampeon: string;
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

export interface AdminResults {
  version: number;
  configured: boolean;
  savedAt: string | null;
  groupPositions: Record<string, GroupPositionValue>;
  knockoutRounds: Record<KnockoutRoundKey, string[]>;
  podium: AdminPodiumResults;
  specialResults: AdminSpecialResults;
}

export const ALL_TEAMS = Object.values(GROUPS).flat();
export const ALL_TEAMS_SORTED = [...ALL_TEAMS].sort((a, b) => a.localeCompare(b, "es"));
export const TEAM_SET = new Set(ALL_TEAMS);

export const KNOCKOUT_COUNTS: Record<KnockoutRoundKey, number> = KNOCKOUT_ROUND_DEFS.reduce((acc, round) => {
  acc[round.key] = round.count;
  return acc;
}, {} as Record<KnockoutRoundKey, number>);

export const KNOCKOUT_LABELS: Record<KnockoutRoundKey, string> = KNOCKOUT_ROUND_DEFS.reduce((acc, round) => {
  acc[round.key] = round.name;
  return acc;
}, {} as Record<KnockoutRoundKey, string>);

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

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function cleanPosition(value: unknown): GroupPositionValue {
  const numeric = Number(value);
  return numeric === 1 || numeric === 2 || numeric === 3 || numeric === 4 ? numeric : 0;
}

function cleanMinute(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.floor(numeric);
}

function normalizeRoundValues(roundKey: KnockoutRoundKey, values: unknown) {
  const requested = Array.isArray(values) ? values : [];
  const used = new Set<string>();
  const next = requested.slice(0, KNOCKOUT_COUNTS[roundKey]).map((value) => {
    const team = cleanTeam(value);
    if (!team || used.has(team)) {
      return "";
    }
    used.add(team);
    return team;
  });

  while (next.length < KNOCKOUT_COUNTS[roundKey]) {
    next.push("");
  }

  return next;
}

export function createDefaultAdminResults(): AdminResults {
  return {
    version: ADMIN_RESULTS_VERSION,
    configured: false,
    savedAt: null,
    groupPositions: ALL_TEAMS.reduce((acc, team) => {
      acc[team] = 0;
      return acc;
    }, {} as Record<string, GroupPositionValue>),
    knockoutRounds: KNOCKOUT_ROUND_DEFS.reduce((acc, round) => {
      acc[round.key] = Array.from({ length: round.count }, () => "");
      return acc;
    }, {} as Record<KnockoutRoundKey, string[]>),
    podium: {
      campeon: "",
      subcampeon: "",
    },
    specialResults: {
      mejorJugador: "",
      mejorJoven: "",
      maxGoleador: "",
      maxAsistente: "",
      mejorPortero: "",
      maxGoleadorEsp: "",
      primerGolEsp: "",
      revelacion: "",
      decepcion: "",
      minutoPrimerGol: null,
    },
  };
}

export function hasConfiguredAdminResults(data: AdminResults) {
  const hasGroups = Object.values(data.groupPositions).some((value) => value > 0);
  const hasRounds = Object.values(data.knockoutRounds).some((round) => round.some(Boolean));
  const hasPodium = Boolean(data.podium.campeon || data.podium.subcampeon);
  const hasSpecials = Object.entries(data.specialResults).some(([key, value]) => key === "minutoPrimerGol" ? value != null : Boolean(value));
  return hasGroups || hasRounds || hasPodium || hasSpecials;
}

export function sanitizeAdminResults(input: Partial<AdminResults> | null | undefined): AdminResults {
  const next = createDefaultAdminResults();
  const current = input || {};

  ALL_TEAMS.forEach((team) => {
    next.groupPositions[team] = cleanPosition(current.groupPositions?.[team]);
  });

  KNOCKOUT_ROUND_DEFS.forEach((round) => {
    next.knockoutRounds[round.key] = normalizeRoundValues(round.key, current.knockoutRounds?.[round.key]);
  });

  next.podium = {
    campeon: cleanTeam(current.podium?.campeon),
    subcampeon: cleanTeam(current.podium?.subcampeon),
  };

  if (next.podium.campeon && next.podium.campeon === next.podium.subcampeon) {
    next.podium.subcampeon = "";
  }

  next.specialResults = {
    mejorJugador: cleanText(current.specialResults?.mejorJugador),
    mejorJoven: cleanText(current.specialResults?.mejorJoven),
    maxGoleador: cleanText(current.specialResults?.maxGoleador),
    maxAsistente: cleanText(current.specialResults?.maxAsistente),
    mejorPortero: cleanText(current.specialResults?.mejorPortero),
    maxGoleadorEsp: cleanText(current.specialResults?.maxGoleadorEsp),
    primerGolEsp: cleanText(current.specialResults?.primerGolEsp),
    revelacion: cleanTeam(current.specialResults?.revelacion),
    decepcion: cleanTeam(current.specialResults?.decepcion),
    minutoPrimerGol: cleanMinute(current.specialResults?.minutoPrimerGol),
  };

  next.version = ADMIN_RESULTS_VERSION;
  next.savedAt = current.savedAt ? String(current.savedAt) : null;
  next.configured = hasConfiguredAdminResults(next);

  return next;
}

export function formatAdminSavedAt(value?: string | null) {
  if (!value) return "Sin guardar";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin guardar";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
