export type MatchStatusGroup =
  | "scheduled"
  | "live"
  | "halftime"
  | "finished"
  | "postponed"
  | "cancelled";

const LIVE_POLLING_STATUS_VALUES = ["LIVE", "1H", "HT", "2H", "ET", "BT", "P"] as const;
const TERMINAL_STATUS_VALUES = ["FT", "AET", "PEN"] as const;

export const LIVE_POLLING_STATUSES = new Set<string>(LIVE_POLLING_STATUS_VALUES);
export const TERMINAL_STATUSES = new Set<string>(TERMINAL_STATUS_VALUES);

export const STATUS_LABELS: Record<string, string> = {
  NS: "Por comenzar",
  TBD: "Por comenzar",
  LIVE: "En juego",
  "1H": "En juego",
  HT: "DESCANSO",
  "2H": "En juego",
  ET: "Prórroga",
  BT: "Descanso prórroga",
  P: "Penaltis",
  FT: "Finalizado",
  AET: "Finalizado (prórroga)",
  PEN: "Finalizado (penaltis)",
  PST: "Aplazado",
  CANC: "Cancelado",
  SUSP: "Suspendido",
  ABD: "Suspendido",
};

function normalizeStatus(statusShort?: string | null): string {
  return (statusShort || "NS").toUpperCase();
}

function formatMadridKickoffTime(kickoff?: string | null): string | null {
  if (!kickoff) return null;

  const parsed = new Date(kickoff);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export function getStatusGroup(statusShort?: string | null): MatchStatusGroup {
  const short = normalizeStatus(statusShort);
  if (["LIVE", "1H", "2H", "ET", "P"].includes(short)) return "live";
  if (["HT", "BT"].includes(short)) return "halftime";
  if (TERMINAL_STATUSES.has(short)) return "finished";
  if (short === "PST") return "postponed";
  if (["CANC", "SUSP", "ABD"].includes(short)) return "cancelled";
  return "scheduled";
}

export function getStatusLabel(statusShort?: string | null): string {
  const short = normalizeStatus(statusShort);
  return STATUS_LABELS[short] || STATUS_LABELS.NS;
}

export function getStatusDisplay(
  statusShort?: string | null,
  options?: { elapsed?: number | null; kickoff?: string | null }
): string {
  const short = normalizeStatus(statusShort);
  const elapsed = typeof options?.elapsed === "number" ? options.elapsed : null;
  const madridTime = formatMadridKickoffTime(options?.kickoff);

  switch (short) {
    case "NS":
    case "TBD":
      return madridTime ? `Por comenzar · ${madridTime}` : "Por comenzar";
    case "LIVE":
    case "1H":
    case "2H":
      return elapsed !== null ? `En juego · min ${elapsed}'` : "En juego";
    case "HT":
      return "DESCANSO";
    case "ET":
      return elapsed !== null ? `Prórroga · min ${elapsed}'` : "Prórroga";
    case "BT":
      return "Descanso prórroga";
    case "P":
      return "Penaltis";
    case "FT":
      return "Finalizado";
    case "AET":
      return "Finalizado (prórroga)";
    case "PEN":
      return "Finalizado (penaltis)";
    case "PST":
      return "Aplazado";
    case "CANC":
      return "Cancelado";
    case "SUSP":
    case "ABD":
      return "Suspendido";
    default:
      return madridTime ? `Por comenzar · ${madridTime}` : getStatusLabel(short);
  }
}

export function shouldShowScore(_statusShort?: string | null, _home?: number | null, _away?: number | null): boolean {
  return true;
}

export function isLiveLike(statusShort?: string | null): boolean {
  return getStatusGroup(statusShort) === "live";
}

export function isLivePollingStatus(statusShort?: string | null): boolean {
  return LIVE_POLLING_STATUSES.has(normalizeStatus(statusShort));
}

export function isTerminalStatus(statusShort?: string | null): boolean {
  return TERMINAL_STATUSES.has(normalizeStatus(statusShort));
}
