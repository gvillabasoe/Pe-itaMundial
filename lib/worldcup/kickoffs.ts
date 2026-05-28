/**
 * HORARIOS OFICIALES (kickoff) de los 104 partidos del Mundial 2026.
 *
 * Fuente ÚNICA de verdad para las fechas/horas de los partidos.
 * Las horas las facilita la organización en HORA ESPAÑOLA (CEST · UTC+2) y aquí
 * se almacenan ya convertidas a ISO 8601 UTC. La interfaz las renderiza con
 * Intl.DateTimeFormat en zona "Europe/Madrid" y formato 24h, por lo que se
 * mostrarán exactamente como en el calendario oficial.
 *
 * La clave es el `id` de partido de WORLD_CUP_MATCHES (1..104).
 */
import { WORLD_CUP_MATCHES } from "@/lib/worldcup/schedule";

export const KICKOFF_BY_MATCH_ID: Record<number, string> = {
  1: "2026-06-11T19:00:00.000Z",
  2: "2026-06-12T02:00:00.000Z",
  3: "2026-06-12T19:00:00.000Z",
  4: "2026-06-13T01:00:00.000Z",
  5: "2026-06-14T01:00:00.000Z",
  6: "2026-06-14T04:00:00.000Z",
  7: "2026-06-13T22:00:00.000Z",
  8: "2026-06-13T19:00:00.000Z",
  9: "2026-06-14T23:00:00.000Z",
  10: "2026-06-14T17:00:00.000Z",
  11: "2026-06-14T20:00:00.000Z",
  12: "2026-06-15T02:00:00.000Z",
  13: "2026-06-15T22:00:00.000Z",
  14: "2026-06-15T16:00:00.000Z",
  15: "2026-06-16T01:00:00.000Z",
  16: "2026-06-15T19:00:00.000Z",
  17: "2026-06-16T19:00:00.000Z",
  18: "2026-06-16T22:00:00.000Z",
  19: "2026-06-17T01:00:00.000Z",
  20: "2026-06-17T04:00:00.000Z",
  21: "2026-06-17T23:00:00.000Z",
  22: "2026-06-17T20:00:00.000Z",
  23: "2026-06-17T17:00:00.000Z",
  24: "2026-06-18T02:00:00.000Z",
  25: "2026-06-18T16:00:00.000Z",
  26: "2026-06-18T19:00:00.000Z",
  27: "2026-06-18T22:00:00.000Z",
  28: "2026-06-19T01:00:00.000Z",
  29: "2026-06-20T00:30:00.000Z",
  30: "2026-06-19T22:00:00.000Z",
  31: "2026-06-20T03:00:00.000Z",
  32: "2026-06-19T19:00:00.000Z",
  33: "2026-06-20T20:00:00.000Z",
  34: "2026-06-21T00:00:00.000Z",
  35: "2026-06-20T17:00:00.000Z",
  36: "2026-06-21T04:00:00.000Z",
  37: "2026-06-21T22:00:00.000Z",
  38: "2026-06-21T16:00:00.000Z",
  39: "2026-06-21T19:00:00.000Z",
  40: "2026-06-22T01:00:00.000Z",
  41: "2026-06-22T21:00:00.000Z",
  42: "2026-06-23T00:00:00.000Z",
  43: "2026-06-22T17:00:00.000Z",
  44: "2026-06-23T03:00:00.000Z",
  45: "2026-06-23T20:00:00.000Z",
  46: "2026-06-23T23:00:00.000Z",
  47: "2026-06-23T17:00:00.000Z",
  48: "2026-06-24T02:00:00.000Z",
  49: "2026-06-24T22:00:00.000Z",
  50: "2026-06-24T22:00:00.000Z",
  51: "2026-06-24T19:00:00.000Z",
  52: "2026-06-24T19:00:00.000Z",
  53: "2026-06-25T01:00:00.000Z",
  54: "2026-06-25T01:00:00.000Z",
  55: "2026-06-25T20:00:00.000Z",
  56: "2026-06-25T20:00:00.000Z",
  57: "2026-06-25T23:00:00.000Z",
  58: "2026-06-25T23:00:00.000Z",
  59: "2026-06-26T02:00:00.000Z",
  60: "2026-06-26T02:00:00.000Z",
  61: "2026-06-26T19:00:00.000Z",
  62: "2026-06-26T19:00:00.000Z",
  63: "2026-06-27T03:00:00.000Z",
  64: "2026-06-27T03:00:00.000Z",
  65: "2026-06-27T00:00:00.000Z",
  66: "2026-06-27T00:00:00.000Z",
  67: "2026-06-27T21:00:00.000Z",
  68: "2026-06-27T21:00:00.000Z",
  69: "2026-06-28T02:00:00.000Z",
  70: "2026-06-28T02:00:00.000Z",
  71: "2026-06-27T23:30:00.000Z",
  72: "2026-06-27T23:30:00.000Z",
  73: "2026-06-28T19:00:00.000Z",
  74: "2026-06-29T20:30:00.000Z",
  75: "2026-06-30T01:00:00.000Z",
  76: "2026-06-29T17:00:00.000Z",
  77: "2026-06-30T21:00:00.000Z",
  78: "2026-06-30T17:00:00.000Z",
  79: "2026-07-01T01:00:00.000Z",
  80: "2026-07-01T16:00:00.000Z",
  81: "2026-07-02T00:00:00.000Z",
  82: "2026-07-01T20:00:00.000Z",
  83: "2026-07-02T23:00:00.000Z",
  84: "2026-07-02T19:00:00.000Z",
  85: "2026-07-03T04:00:00.000Z",
  86: "2026-07-03T22:00:00.000Z",
  87: "2026-07-04T01:30:00.000Z",
  88: "2026-07-03T19:00:00.000Z",
  89: "2026-07-04T21:00:00.000Z",
  90: "2026-07-04T17:00:00.000Z",
  91: "2026-07-05T20:00:00.000Z",
  92: "2026-07-06T01:00:00.000Z",
  93: "2026-07-06T19:00:00.000Z",
  94: "2026-07-07T00:00:00.000Z",
  95: "2026-07-07T16:00:00.000Z",
  96: "2026-07-07T20:00:00.000Z",
  97: "2026-07-09T20:00:00.000Z",
  98: "2026-07-10T19:00:00.000Z",
  99: "2026-07-11T21:00:00.000Z",
  100: "2026-07-12T01:00:00.000Z",
  101: "2026-07-14T19:00:00.000Z",
  102: "2026-07-15T19:00:00.000Z",
  103: "2026-07-18T21:00:00.000Z",
  104: "2026-07-19T19:00:00.000Z",
};

const FALLBACK_KICKOFF = "2026-06-11T19:00:00.000Z";

/** Kickoff ISO (UTC) para un id de partido del calendario oficial. */
export function getKickoffByMatchId(id: number): string {
  return KICKOFF_BY_MATCH_ID[id] ?? FALLBACK_KICKOFF;
}

// ── Mapa por par de equipos (solo fase de grupos) ──────────────────────────
// Derivado del calendario oficial para que lib/data.ts pueda asignar el kickoff
// correcto a cada FIXTURE de la fase de grupos sin duplicar las horas.
function pairKey(home: string, away: string): string {
  const n = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  return `${n(home)}|${n(away)}`;
}

const GROUP_KICKOFF_BY_PAIR = new Map<string, string>();
WORLD_CUP_MATCHES.filter((match) => match.stage === "group").forEach((match) => {
  const iso = KICKOFF_BY_MATCH_ID[match.id];
  if (!iso) return;
  GROUP_KICKOFF_BY_PAIR.set(pairKey(match.homeTeam, match.awayTeam), iso);
  GROUP_KICKOFF_BY_PAIR.set(pairKey(match.awayTeam, match.homeTeam), iso);
});

/** Kickoff ISO (UTC) de un partido de grupos por su par de equipos (bidireccional). */
export function getGroupKickoffByPair(home: string, away: string): string | undefined {
  return GROUP_KICKOFF_BY_PAIR.get(pairKey(home, away));
}
