import { getKickoffByMatchId } from "@/lib/worldcup/kickoffs";

// ════════════════════════════════════════════════════════════
// Lógica de la tarjeta de la home: cuenta atrás encadenada con
// marcador en vivo.
//
// Para cada partido de la secuencia:
//   1. Antes del kickoff → cuenta atrás.
//   2. Desde el kickoff → marcador en vivo (datos de /api/results/fixtures,
//      el mismo endpoint que la pestaña Resultados).
//   3. Cuando el partido termina, el resultado final se mantiene visible
//      1 HORA y después la tarjeta pasa a la cuenta atrás del siguiente.
//
// Red de seguridad si la API no responde o la página se abre más tarde:
// un partido se da por "pasado" a las 3 h del kickoff (≈ 2 h de partido
// + 1 h de cortesía), salvo que la API diga que sigue en juego.
// ════════════════════════════════════════════════════════════

export const HOME_COUNTDOWN_SEQUENCE = [
  { matchId: 1, homeTeam: "México", awayTeam: "Sudáfrica" },
  { matchId: 14, homeTeam: "España", awayTeam: "Cabo Verde" },
  { matchId: 38, homeTeam: "España", awayTeam: "Arabia Saudí" },
  { matchId: 66, homeTeam: "Uruguay", awayTeam: "España" },
] as const;

export const HOLD_AFTER_FINISH_MS = 60 * 60 * 1000; // 1 hora
export const MATCH_WINDOW_FALLBACK_MS = 3 * 60 * 60 * 1000; // 3 horas

export const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "P", "BT", "LIVE", "INT"]);
export const FINISHED_STATUSES = new Set(["FT", "AET", "PEN", "AWD", "WO"]);

export const STATUS_LABELS: Record<string, string> = {
  "1H": "1ª parte",
  HT: "Descanso",
  "2H": "2ª parte",
  ET: "Prórroga",
  BT: "Descanso prórroga",
  P: "Penaltis",
  INT: "Interrumpido",
  LIVE: "En juego",
  FT: "Finalizado",
  AET: "Final tras prórroga",
  PEN: "Final tras penaltis",
  SUSP: "Suspendido",
  PST: "Aplazado",
  CANC: "Cancelado",
  ABD: "Abandonado",
};

export interface HomeCountdownEntry {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  time: number;
}

export interface HomeGoal {
  minute: number | null;
  player: string;
  side: "home" | "away";
  penalty: boolean;
  ownGoal: boolean;
}

export interface HomeFixture {
  homeTeam: string;
  awayTeam: string;
  statusShort: string;
  minute: number | null;
  score: { home: number | null; away: number | null };
  goals: HomeGoal[];
}

export interface HomeCardState {
  entry: HomeCountdownEntry;
  mode: "countdown" | "live";
  /** Fixture orientado al orden local/visitante del calendario (o null si aún no hay datos) */
  fixture: HomeFixture | null;
}

export function buildHomeCountdownEntries(): HomeCountdownEntry[] {
  return HOME_COUNTDOWN_SEQUENCE.map((item) => {
    const kickoff = getKickoffByMatchId(item.matchId);
    return { ...item, kickoff, time: new Date(kickoff).getTime() };
  });
}

function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function pairKey(home: string, away: string): string {
  return `${normalizeKey(home)}|${normalizeKey(away)}`;
}

export function indexFixturesByPair(raw: unknown): Map<string, HomeFixture> {
  const map = new Map<string, HomeFixture>();
  if (!Array.isArray(raw)) return map;
  for (const item of raw) {
    const f = item as Record<string, unknown>;
    const score = (f.score || {}) as Record<string, unknown>;
    const rawGoals = Array.isArray(f.goals) ? f.goals : [];
    const goals: HomeGoal[] = rawGoals
      .map((g) => {
        const r = g as Record<string, unknown>;
        const side = r.side === "away" ? "away" : r.side === "home" ? "home" : null;
        if (!side) return null;
        return {
          minute: typeof r.minute === "number" ? r.minute : null,
          player: String(r.player || "").trim(),
          side,
          penalty: r.penalty === true,
          ownGoal: r.ownGoal === true,
        } as HomeGoal;
      })
      .filter((g): g is HomeGoal => g !== null);
    const fixture: HomeFixture = {
      homeTeam: String(f.homeTeam || ""),
      awayTeam: String(f.awayTeam || ""),
      statusShort: String(f.statusShort || "NS"),
      minute: typeof f.minute === "number" ? f.minute : null,
      score: {
        home: typeof score.home === "number" ? score.home : null,
        away: typeof score.away === "number" ? score.away : null,
      },
      goals,
    };
    if (fixture.homeTeam && fixture.awayTeam) {
      map.set(pairKey(fixture.homeTeam, fixture.awayTeam), fixture);
    }
  }
  return map;
}

/**
 * Busca el fixture del partido en ambos órdenes de equipos. Si la API lo
 * trae con local/visitante invertido respecto al calendario, devuelve el
 * marcador ya volteado al orden del calendario.
 */
export function findFixtureForEntry(
  fixturesByPair: Map<string, HomeFixture>,
  entry: Pick<HomeCountdownEntry, "homeTeam" | "awayTeam">
): HomeFixture | null {
  const direct = fixturesByPair.get(pairKey(entry.homeTeam, entry.awayTeam));
  if (direct) return direct;
  const reversed = fixturesByPair.get(pairKey(entry.awayTeam, entry.homeTeam));
  if (reversed) {
    return {
      ...reversed,
      homeTeam: entry.homeTeam,
      awayTeam: entry.awayTeam,
      score: { home: reversed.score.away, away: reversed.score.home },
      goals: reversed.goals.map((g) => ({ ...g, side: g.side === "home" ? "away" as const : "home" as const })),
    };
  }
  return null;
}

/**
 * Decide qué partido y en qué modo debe mostrar la tarjeta.
 *
 * @param finishedAtByMatchId instante (ms) en que se observó por primera vez
 *   el estado "finalizado" de cada partido (lo registra el componente al
 *   recibir cada respuesta de la API).
 */
export function resolveHomeCardState(
  entries: HomeCountdownEntry[],
  now: number,
  fixturesByPair: Map<string, HomeFixture>,
  finishedAtByMatchId: Record<number, number>
): HomeCardState {
  for (const entry of entries) {
    const fixture = findFixtureForEntry(fixturesByPair, entry);
    const status = fixture?.statusShort ?? null;
    const reportedLive = status !== null && LIVE_STATUSES.has(status);

    const finishedAt = finishedAtByMatchId[entry.matchId];
    const heldLongEnough = finishedAt != null && now >= finishedAt + HOLD_AFTER_FINISH_MS;
    const windowExpired = now >= entry.time + MATCH_WINDOW_FALLBACK_MS && !reportedLive;

    const advanced = heldLongEnough || windowExpired;
    if (advanced) continue;

    if (now < entry.time) {
      return { entry, mode: "countdown", fixture };
    }
    return { entry, mode: "live", fixture };
  }

  // Toda la secuencia pasada: dejamos el último con su resultado final.
  const last = entries[entries.length - 1];
  return { entry: last, mode: "live", fixture: findFixtureForEntry(fixturesByPair, last) };
}
