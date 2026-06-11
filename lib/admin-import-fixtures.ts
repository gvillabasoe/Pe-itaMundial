import { WORLD_CUP_MATCHES, type MatchStage, type WorldCupMatch } from "@/lib/worldcup/schedule";
import { isConfiguredMatchResult, type AdminMatchResult, type AdminResults } from "@/lib/admin-results";

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
//       · Eliminatorias → asignación posicional por fase, ordenando
//         por fecha de inicio (igual que la pestaña Resultados).
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

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

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

function isFinishedWithScore(fixture: ApiFixtureLike): boolean {
  return (
    FINISHED_STATUSES.has(fixture.statusShort) &&
    typeof fixture.score.home === "number" &&
    typeof fixture.score.away === "number"
  );
}

function sanitizeFixtures(raw: unknown): ApiFixtureLike[] {
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
function buildFinishedResultsByMatchId(
  fixtures: ApiFixtureLike[]
): Map<string, { home: number; away: number }> {
  const results = new Map<string, { home: number; away: number }>();

  // Index de fase de grupos por pareja (orden directo)
  const groupApiByPair = new Map<string, ApiFixtureLike>();
  fixtures
    .filter((f) => f.stage === "group")
    .forEach((f) => {
      groupApiByPair.set(pairKey(f.homeTeam, f.awayTeam), f);
    });

  // Index de eliminatorias por fase, ordenadas por kickoff (posicional)
  const apiByStage = new Map<MatchStage, ApiFixtureLike[]>();
  STAGE_ORDER.forEach((stage) => {
    const list = fixtures
      .filter((f) => f.stage === stage)
      .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
    apiByStage.set(stage, list);
  });
  const stageOffsets = new Map<MatchStage, number>();
  STAGE_ORDER.forEach((stage) => stageOffsets.set(stage, 0));

  const scheduleSorted: WorldCupMatch[] = [...WORLD_CUP_MATCHES].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  for (const match of scheduleSorted) {
    let api: ApiFixtureLike | undefined;
    let flipped = false;

    if (match.stage === "group") {
      api = groupApiByPair.get(pairKey(match.homeTeam, match.awayTeam));
      if (!api) {
        api = groupApiByPair.get(pairKey(match.awayTeam, match.homeTeam));
        if (api) flipped = true;
      }
    } else {
      const list = apiByStage.get(match.stage) || [];
      const idx = stageOffsets.get(match.stage) ?? 0;
      api = list[idx];
      stageOffsets.set(match.stage, idx + 1);
    }

    if (!api || !isFinishedWithScore(api)) continue;

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

  const finishedById = buildFinishedResultsByMatchId(fixtures);

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
