import { WORLD_CUP_MATCHES, type MatchStage } from "@/lib/worldcup/schedule";
import { GROUP_MATCH_IDS, decideFinalGroupPositions, type GroupMatchScore } from "@/lib/worldcup/group-tables";
import { TEAM_SET, KNOCKOUT_ADMIN_COUNTS, type KnockoutRoundKey } from "@/lib/admin-results";
import { isConfiguredMatchResult, type AdminMatchResult, type AdminResults } from "@/lib/admin-results";
import { resolveKnockoutMatchTeams } from "@/lib/worldcup/resolve-knockout";

// ════════════════════════════════════════════════════════════
// Importación de resultados finalizados desde /api/results/fixtures
// hacia los resultados oficiales del panel Admin.
//
// Reglas:
//   - Solo se importan partidos FINALIZADOS (FT / AET / PEN) con
//     marcador numérico completo.
//   - NUNCA se pisa un resultado que el admin ya haya confirmado a
//     mano: los partidos ya configurados se saltan.
//   - El emparejamiento replica el de app/resultados/page.tsx:
//       · Fase de grupos → por pareja de equipos (en ambos órdenes).
//         Si la API trae el local/visitante invertido respecto al
//         calendario oficial, el marcador se voltea para que los
//         puntos se calculen contra el orden correcto.
//       · Eliminatorias → por pareja de equipos ya resueltos (posiciones
//         de grupo / listas del admin), en ambos órdenes, volteando el
//         marcador si la API trae local/visitante invertido. (Antes era
//         posicional por hora y asignaba el marcador al cruce equivocado.)
//   - No se guarda nada automáticamente: esta función solo devuelve
//     el formulario actualizado. El admin revisa y pulsa "Guardar".
// ════════════════════════════════════════════════════════════

interface ApiFixtureLike {
  stage: MatchStage;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  statusShort: string;
  score: { home: number | null; away: number | null };
}

export interface ImportFinishedSummary {
  /** Partidos cuyo marcador se ha rellenado en el formulario */
  imported: number;
  /** Partidos finalizados en la API pero que el admin ya tenía confirmados */
  skippedConfigured: number;
  /** Partidos de la API aún sin finalizar (no se tocan) */
  notFinished: number;
  /** Formulario resultante (sin guardar) */
  next: AdminResults;
  /** Valores escritos por la importación, por matchId (para poder deshacer) */
  applied: Record<string, AdminMatchResult>;
  /** Valores que había antes de la importación, por matchId */
  previous: Record<string, AdminMatchResult>;
}

export const FINISHED_STATUSES = new Set(["FT", "AET", "PEN", "AWD", "WO"]);
export const IN_PLAY_STATUSES = new Set(["1H", "HT", "2H", "ET", "P", "BT", "LIVE", "INT"]);

const STAGE_ORDER: MatchStage[] = [
  "group",
  "round-of-32",
  "round-of-16",
  "quarter-final",
  "semi-final",
  "third-place",
  "final",
];

// Misma normalización que usa app/resultados/page.tsx para emparejar
function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pairKey(home: string, away: string): string {
  return `${normalizeKey(home)}|${normalizeKey(away)}`;
}

function hasScoreWithStatus(fixture: ApiFixtureLike, statuses: Set<string>): boolean {
  return (
    statuses.has(fixture.statusShort) &&
    typeof fixture.score.home === "number" &&
    typeof fixture.score.away === "number"
  );
}

export function sanitizeFixtures(raw: unknown): ApiFixtureLike[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): ApiFixtureLike | null => {
      const f = item as Record<string, unknown>;
      const score = (f.score || {}) as Record<string, unknown>;
      const stage = String(f.stage || "");
      if (!STAGE_ORDER.includes(stage as MatchStage)) return null;
      return {
        stage: stage as MatchStage,
        homeTeam: String(f.homeTeam || ""),
        awayTeam: String(f.awayTeam || ""),
        kickoff: String(f.kickoff || ""),
        statusShort: String(f.statusShort || "NS"),
        score: {
          home: typeof score.home === "number" ? score.home : null,
          away: typeof score.away === "number" ? score.away : null,
        },
      };
    })
    .filter((f): f is ApiFixtureLike => f !== null);
}

/**
 * Empareja cada partido del calendario oficial con su fixture de la API
 * (si existe) y devuelve, por matchId, el resultado finalizado a importar
 * ya orientado al orden local/visitante del calendario oficial.
 */
export function buildResultsByMatchId(
  fixtures: ApiFixtureLike[],
  statuses: Set<string> = FINISHED_STATUSES,
  admin?: AdminResults
): Map<string, { home: number; away: number }> {
  const results = new Map<string, { home: number; away: number }>();

  // Index de fase de grupos por pareja (orden directo)
  const groupApiByPair = new Map<string, ApiFixtureLike>();
  fixtures
    .filter((f) => f.stage === "group")
    .forEach((f) => {
      groupApiByPair.set(pairKey(f.homeTeam, f.awayTeam), f);
    });

  // Index de ELIMINATORIAS por pareja de equipos (ambas orientaciones). Antes se
  // asignaba por POSICIÓN (orden por hora vs sortOrder del calendario) y, como el
  // #id de partido NO es cronológico, el marcador acababa en el cruce equivocado
  // (el mismo bug que en la pestaña Resultados). Emparejar por los equipos ya
  // resueltos lo arregla. Necesita `admin` para resolver los cruces
  // ("1.º Grupo X", "Ganador N", "Mejor 3.º …"); sin él no se importan
  // eliminatorias (p. ej. las tablas de grupos en vivo no lo necesitan).
  const knockoutApiByPair = new Map<string, ApiFixtureLike>();
  fixtures
    .filter((f) => f.stage !== "group")
    .forEach((f) => {
      knockoutApiByPair.set(pairKey(f.homeTeam, f.awayTeam), f);
    });

  for (const match of WORLD_CUP_MATCHES) {
    let api: ApiFixtureLike | undefined;
    let flipped = false;

    if (match.stage === "group") {
      api = groupApiByPair.get(pairKey(match.homeTeam, match.awayTeam));
      if (!api) {
        api = groupApiByPair.get(pairKey(match.awayTeam, match.homeTeam));
        if (api) flipped = true;
      }
    } else {
      if (!admin) continue; // sin admin no se pueden resolver los cruces
      const { homeTeam, awayTeam } = resolveKnockoutMatchTeams(match, admin);
      // Cruce aún sin determinar (placeholders sin resolver) → no se importa.
      if (!TEAM_SET.has(homeTeam) || !TEAM_SET.has(awayTeam)) continue;
      api = knockoutApiByPair.get(pairKey(homeTeam, awayTeam));
      if (!api) {
        api = knockoutApiByPair.get(pairKey(awayTeam, homeTeam));
        if (api) flipped = true;
      }
    }

    if (!api || !hasScoreWithStatus(api, statuses)) continue;

    const home = flipped ? (api.score.away as number) : (api.score.home as number);
    const away = flipped ? (api.score.home as number) : (api.score.away as number);
    results.set(String(match.id), { home, away });
  }

  return results;
}

/**
 * Descarga los fixtures, calcula qué partidos finalizados faltan por
 * confirmar y devuelve un AdminResults nuevo con esos marcadores
 * rellenados. NO guarda nada: el admin revisa y pulsa "Guardar cambios".
 */
export async function importFinishedResultsFromApi(
  form: AdminResults
): Promise<ImportFinishedSummary> {
  const response = await fetch("/api/results/fixtures", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`La API de resultados respondió ${response.status}`);
  }

  const payload = await response.json();
  const fixtures = sanitizeFixtures(payload?.fixtures);

  if (fixtures.length === 0) {
    const reason = typeof payload?.error === "string" ? ` (${payload.error})` : "";
    throw new Error(`La API no ha devuelto partidos${reason}`);
  }

  const finishedById = buildResultsByMatchId(fixtures, FINISHED_STATUSES, form);

  let imported = 0;
  let skippedConfigured = 0;
  const nextMatchResults = { ...form.matchResults };
  const applied: Record<string, AdminMatchResult> = {};
  const previous: Record<string, AdminMatchResult> = {};

  finishedById.forEach((score, matchId) => {
    const current = form.matchResults[matchId];
    if (isConfiguredMatchResult(current)) {
      skippedConfigured += 1;
      return;
    }
    previous[matchId] = current
      ? { ...current }
      : { home: null, away: null, statusShort: "NS" };
    const value: AdminMatchResult = { home: score.home, away: score.away, statusShort: "FT" };
    nextMatchResults[matchId] = value;
    applied[matchId] = { ...value };
    imported += 1;
  });

  const notFinished = WORLD_CUP_MATCHES.length - finishedById.size;

  return {
    imported,
    skippedConfigured,
    notFinished,
    next: { ...form, matchResults: nextMatchResults },
    applied,
    previous,
  };
}

function sameMatchResult(a: AdminMatchResult | undefined, b: AdminMatchResult): boolean {
  return !!a && a.home === b.home && a.away === b.away && a.statusShort === b.statusShort;
}

export interface RevertImportSummary {
  /** Partidos devueltos a su valor anterior a la importación */
  reverted: number;
  /** Partidos importados que el admin editó después → se respetan, no se revierten */
  keptEdited: number;
  /** Formulario resultante (sin guardar) */
  next: AdminResults;
}

/**
 * Deshace una importación previa: devuelve cada partido importado a su valor
 * anterior, PERO solo si su valor actual sigue siendo exactamente el que dejó
 * la importación. Si el admin lo editó a mano después de importar, se respeta
 * su edición y no se toca. No guarda nada.
 */
export function revertImportedResults(
  form: AdminResults,
  applied: Record<string, AdminMatchResult>,
  previous: Record<string, AdminMatchResult>
): RevertImportSummary {
  let reverted = 0;
  let keptEdited = 0;
  const nextMatchResults = { ...form.matchResults };

  Object.keys(applied).forEach((matchId) => {
    const current = form.matchResults[matchId];
    if (sameMatchResult(current, applied[matchId])) {
      nextMatchResults[matchId] = {
        ...(previous[matchId] || { home: null, away: null, statusShort: "NS" }),
      };
      reverted += 1;
    } else {
      keptEdited += 1;
    }
  });

  return {
    reverted,
    keptEdited,
    next: { ...form, matchResults: nextMatchResults },
  };
}

// ════════════════════════════════════════════════════════════
// Merge puro: rellena en un AdminResults los marcadores que la API
// da con los estados indicados, SIN tocar nada confirmado a mano.
// Lo usan:
//   - /api/admin-results (servidor) con FINISHED_STATUSES, cuando el
//     switch "Resultados automáticos" está activo → la app entera
//     puntúa sola con los partidos finalizados.
//   - El ranking en vivo (cliente) con FINISHED ∪ IN_PLAY → la
//     clasificación provisional mientras hay partidos en juego.
// ════════════════════════════════════════════════════════════
export interface ApplyApiResultsOutcome {
  merged: AdminResults;
  /** matchIds rellenados desde la API en esta pasada */
  filled: string[];
}

export function applyApiResultsToAdminResults(
  admin: AdminResults,
  rawFixtures: unknown,
  statuses: Set<string> = FINISHED_STATUSES
): ApplyApiResultsOutcome {
  const fixtures = sanitizeFixtures(rawFixtures);
  if (fixtures.length === 0) return { merged: admin, filled: [] };

  const byMatchId = buildResultsByMatchId(fixtures, statuses, admin);
  if (byMatchId.size === 0) return { merged: admin, filled: [] };

  const filled: string[] = [];
  const nextMatchResults = { ...admin.matchResults };

  byMatchId.forEach((score, matchId) => {
    if (isConfiguredMatchResult(admin.matchResults[matchId])) return;
    nextMatchResults[matchId] = { home: score.home, away: score.away, statusShort: "FT" };
    filled.push(matchId);
  });

  if (filled.length === 0) return { merged: admin, filled };

  return {
    merged: {
      ...admin,
      configured: true,
      matchResults: nextMatchResults,
    },
    filled,
  };
}

// ════════════════════════════════════════════════════════════
// AUTOCOMPLETADO DE POSICIONES DE GRUPO
//
// Para cada grupo cuyos 6 partidos están confirmados (a mano o por la
// API tras el merge de marcadores) y cuyas posiciones el admin NO ha
// tocado, calcula la tabla con criterios FIFA (a–f) y rellena las
// posiciones 1–4. Si el desempate requiere fair play/sorteo, se
// abstiene y lo deja para el humano.
// ════════════════════════════════════════════════════════════
export function applyApiGroupPositionsToAdminResults(
  admin: AdminResults
): { merged: AdminResults; filledGroups: string[] } {
  const filledGroups: string[] = [];
  let nextPositions: Record<string, import("@/lib/admin-results").GroupPositionValue> | null = null;

  const matchById = new Map(WORLD_CUP_MATCHES.map((m) => [m.id, m]));

  for (const [letter, matchIds] of Object.entries(GROUP_MATCH_IDS)) {
    const scores: GroupMatchScore[] = [];
    let complete = true;
    for (const matchId of matchIds) {
      const result = admin.matchResults[String(matchId)];
      const match = matchById.get(matchId);
      if (!match || !isConfiguredMatchResult(result)) {
        complete = false;
        break;
      }
      scores.push({
        matchId,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        home: result!.home as number,
        away: result!.away as number,
      });
    }
    if (!complete) continue;

    // Solo si el admin no ha puesto NINGUNA posición de este grupo
    const positions = decideFinalGroupPositions(letter, scores);
    if (!positions) continue;
    const groupTeams = [...positions.keys()];
    const untouched = groupTeams.every((team) => (admin.groupPositions[team] ?? 0) === 0);
    if (!untouched) continue;

    if (!nextPositions) nextPositions = { ...admin.groupPositions };
    positions.forEach((pos, team) => {
      nextPositions![team] = pos;
    });
    filledGroups.push(letter);
  }

  if (!nextPositions) return { merged: admin, filledGroups };
  return {
    merged: { ...admin, configured: true, groupPositions: nextPositions },
    filledGroups,
  };
}

// ════════════════════════════════════════════════════════════
// AUTOCOMPLETADO DE RONDAS ELIMINATORIAS
//
// Los equipos que ALCANZAN cada ronda son, simplemente, los que aparecen
// en los cruces de esa fase según la API (ESPN publica los emparejamientos
// con nombres reales en cuanto se definen). Una ronda solo se rellena si:
//   - el admin la tiene completamente vacía, y
//   - la API aporta exactamente el nº de equipos de la ronda (32/16/8/4/2),
//     todos válidos (se descartan placeholders tipo "TBD").
// La clave "final" son los 2 finalistas (el 3.er puesto no cuenta aquí).
// ════════════════════════════════════════════════════════════
const STAGE_TO_ROUND_KEY: Partial<Record<MatchStage, KnockoutRoundKey>> = {
  "round-of-32": "dieciseisavos" as KnockoutRoundKey,
  "round-of-16": "octavos" as KnockoutRoundKey,
  "quarter-final": "cuartos" as KnockoutRoundKey,
  "semi-final": "semis" as KnockoutRoundKey,
  final: "final" as KnockoutRoundKey,
};

export function applyApiKnockoutsToAdminResults(
  admin: AdminResults,
  rawFixtures: unknown
): { merged: AdminResults; filledRounds: KnockoutRoundKey[] } {
  const fixtures = sanitizeFixtures(rawFixtures);
  const filledRounds: KnockoutRoundKey[] = [];
  if (fixtures.length === 0) return { merged: admin, filledRounds };

  let nextRounds: Record<KnockoutRoundKey, string[]> | null = null;

  for (const [stage, roundKey] of Object.entries(STAGE_TO_ROUND_KEY) as Array<[MatchStage, KnockoutRoundKey]>) {
    const stored = admin.knockoutRounds[roundKey] || [];
    const untouched = stored.every((value) => !value);
    if (!untouched) continue;

    const teams = new Set<string>();
    fixtures
      .filter((f) => f.stage === stage)
      .forEach((f) => {
        if (TEAM_SET.has(f.homeTeam)) teams.add(f.homeTeam);
        if (TEAM_SET.has(f.awayTeam)) teams.add(f.awayTeam);
      });

    const expected = KNOCKOUT_ADMIN_COUNTS[roundKey];
    if (teams.size !== expected) continue;

    const ordered = [...teams].sort((a, b) => a.localeCompare(b, "es"));
    if (!nextRounds) nextRounds = { ...admin.knockoutRounds };
    nextRounds[roundKey] = ordered;
    filledRounds.push(roundKey);
  }

  if (!nextRounds) return { merged: admin, filledRounds };
  return {
    merged: { ...admin, configured: true, knockoutRounds: nextRounds },
    filledRounds,
  };
}

// ════════════════════════════════════════════════════════════
// SUGERENCIAS DE PREMIOS ESPECIALES A PARTIR DE LOS GOLEADORES
// ════════════════════════════════════════════════════════════
interface RawGoalLike {
  minute: number | null;
  player: string;
  side: "home" | "away";
}

function readGoals(value: unknown): RawGoalLike[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((g) => {
      const r = g as Record<string, unknown>;
      const side = r.side === "away" ? "away" : r.side === "home" ? "home" : null;
      if (!side) return null;
      return {
        minute: typeof r.minute === "number" ? r.minute : null,
        player: String(r.player || "").trim(),
        side,
      } as RawGoalLike;
    })
    .filter((g): g is RawGoalLike => g !== null);
}

/** Minuto del PRIMER gol del torneo (partido inaugural). null si aún no hay. */
export function extractFirstGoalMinute(rawFixtures: unknown): number | null {
  if (!Array.isArray(rawFixtures)) return null;
  const opener = WORLD_CUP_MATCHES.find((m) => m.id === 1);
  if (!opener) return null;
  for (const f of rawFixtures as Array<Record<string, unknown>>) {
    const home = String(f.homeTeam || "");
    const away = String(f.awayTeam || "");
    const samePair =
      (home === opener.homeTeam && away === opener.awayTeam) ||
      (home === opener.awayTeam && away === opener.homeTeam);
    if (!samePair) continue;
    if (!FINISHED_STATUSES.has(String(f.statusShort || ""))) return null;
    const goals = readGoals(f.goals).filter((g) => typeof g.minute === "number");
    if (goals.length === 0) return null;
    return Math.min(...goals.map((g) => g.minute as number));
  }
  return null;
}

/** Primer goleador de un equipo en el torneo (cronológico). Solo informativo. */
export function extractFirstScorerForTeam(
  rawFixtures: unknown,
  team: string
): { player: string; minute: number | null; matchLabel: string } | null {
  if (!Array.isArray(rawFixtures)) return null;
  const candidates = (rawFixtures as Array<Record<string, unknown>>)
    .filter((f) => f.homeTeam === team || f.awayTeam === team)
    .sort((a, b) => new Date(String(a.kickoff || "")).getTime() - new Date(String(b.kickoff || "")).getTime());
  for (const f of candidates) {
    const side = f.homeTeam === team ? "home" : "away";
    const goals = readGoals(f.goals)
      .filter((g) => g.side === side && g.player && g.player !== "—")
      .sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999));
    if (goals.length > 0) {
      return {
        player: goals[0].player,
        minute: goals[0].minute,
        matchLabel: `${String(f.homeTeam)} vs ${String(f.awayTeam)}`,
      };
    }
  }
  return null;
}
