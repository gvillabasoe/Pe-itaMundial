export type MatchStatusGroup =
  | "scheduled"
  | "live"
  | "halftime"
  | "finished"
  | "postponed"
  | "cancelled";

export const STATUS_LABELS: Record<string, string> = {
  NS: "Programado",
  TBD: "Programado",
  LIVE: "En directo",
  "1H": "1ª parte",
  "2H": "2ª parte",
  ET: "Prórroga",
  P: "Penaltis",
  HT: "Descanso",
  FT: "Finalizado",
  AET: "Final tras prórroga",
  PEN: "Final tras penaltis",
  PST: "Aplazado",
  CANC: "Cancelado",
  SUSP: "Suspendido",
  ABD: "Suspendido",
};

export function getStatusGroup(statusShort?: string | null): MatchStatusGroup {
  const short = (statusShort || "NS").toUpperCase();
  if (["1H", "2H", "ET", "P", "LIVE"].includes(short)) return "live";
  if (short === "HT") return "halftime";
  if (["FT", "AET", "PEN"].includes(short)) return "finished";
  if (short === "PST") return "postponed";
  if (["CANC", "SUSP", "ABD"].includes(short)) return "cancelled";
  return "scheduled";
}

export function getStatusLabel(statusShort?: string | null): string {
  const short = (statusShort || "NS").toUpperCase();
  return STATUS_LABELS[short] || STATUS_LABELS.NS;
}

export function shouldShowScore(statusShort?: string | null, home?: number | null, away?: number | null): boolean {
  if (home === null || home === undefined || away === null || away === undefined) return false;
  const group = getStatusGroup(statusShort);
  return group === "live" || group === "halftime" || group === "finished";
}

export function isLiveLike(statusShort?: string | null): boolean {
  return getStatusGroup(statusShort) === "live";
}
