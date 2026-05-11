import { GROUPS, type Team } from "@/lib/data";
import { FIXTURES } from "@/lib/data";
import { WORLD_CUP_MATCHES } from "@/lib/worldcup/schedule";
import { normalizeCountryKey } from "@/lib/flags";
import type { AdminResults } from "@/lib/admin-results";
import {
  CSV_TEMPLATE_HEADERS,
  GROUP_KEYS_AL,
  GROUP_MATCH_SCHEMA,
} from "@/lib/csv-template";

// ════════════════════════════════════════════════════════════════════════════
// Exportación CSV con el esquema de 269 columnas.
//
// Genera 2 líneas: header (fijo) + valores de la porra activa, separados por
// coma. Solo usa team.* — no usa adminResults ni cálculos de puntos.
// ════════════════════════════════════════════════════════════════════════════

// ── CSV escape: si la celda contiene coma, comillas o salto de línea,
//    envolverla en " y duplicar comillas internas ──
function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s === "") return "";
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ── Lookup de fixtures por par de equipos normalizado, en ambos sentidos ──
type FixtureLookupEntry = {
  fixture: (typeof FIXTURES)[number];
  /** true si el par del schema está invertido respecto al fixture interno */
  swapped: boolean;
};

function buildKey(home: string, away: string): string {
  return `${normalizeCountryKey(home)}|${normalizeCountryKey(away)}`;
}

function buildFixtureLookup(): Map<string, FixtureLookupEntry> {
  const map = new Map<string, FixtureLookupEntry>();
  for (const fixture of FIXTURES) {
    if (fixture.stage !== "groups") continue;
    const direct = buildKey(fixture.homeTeam, fixture.awayTeam);
    const inverse = buildKey(fixture.awayTeam, fixture.homeTeam);
    // Primero registramos la dirección directa
    if (!map.has(direct)) map.set(direct, { fixture, swapped: false });
    // Después la inversa, solo si no existe ya
    if (!map.has(inverse)) map.set(inverse, { fixture, swapped: true });
  }
  return map;
}

// ── Lista de los 72 partidos oficiales en orden canónico ──
const ORDERED_GROUP_MATCHES = WORLD_CUP_MATCHES
  .filter((m) => m.stage === "group")
  .slice()
  .sort((a, b) => a.sortOrder - b.sortOrder);

// ── Resolver los goles de un partido oficial desde team.matchPicks ──
//    El team.matchPicks usa IDs internos de FIXTURES (f1, f2…), no los IDs
//    1..72 de WORLD_CUP_MATCHES. Por eso buscamos por pareja de equipos.
function resolveMatchScore(
  team: Team,
  officialHome: string,
  officialAway: string,
  lookup: Map<string, FixtureLookupEntry>,
): { home: string; away: string } {
  const direct = lookup.get(buildKey(officialHome, officialAway));
  if (direct) {
    const pick = team.matchPicks?.[direct.fixture.id];
    if (!pick) return { home: "", away: "" };
    if (direct.swapped) {
      // El fixture interno tiene los equipos invertidos respecto al schema
      const homeGoals = pick.away;
      const awayGoals = pick.home;
      return {
        home: typeof homeGoals === "number" ? String(homeGoals) : "",
        away: typeof awayGoals === "number" ? String(awayGoals) : "",
      };
    }
    return {
      home: typeof pick.home === "number" ? String(pick.home) : "",
      away: typeof pick.away === "number" ? String(pick.away) : "",
    };
  }
  return { home: "", away: "" };
}

// ── Construir los 269 valores en el mismo orden que CSV_TEMPLATE_HEADERS ──
function buildRowValues(team: Team): string[] {
  const lookup = buildFixtureLookup();
  const values: string[] = [];

  // A) Identificación
  values.push(escapeCsvCell(team.username || ""));
  values.push(escapeCsvCell(team.name || ""));

  // B) 144 marcadores (72 partidos × 2)
  for (const entry of GROUP_MATCH_SCHEMA) {
    const { home, away } = resolveMatchScore(team, entry.homeTeam, entry.awayTeam, lookup);
    values.push(escapeCsvCell(home));
    values.push(escapeCsvCell(away));
  }

  // C) 48 posiciones de grupo (12 × 4)
  for (const groupKey of GROUP_KEYS_AL) {
    const picks = team.groupOrderPicks?.[groupKey] || [];
    for (let i = 0; i < 4; i++) {
      values.push(escapeCsvCell(picks[i] || ""));
    }
  }

  // D.1) 32 equipos en dieciseisavos — preferimos team.roundOf32Teams si existe;
  //      si no, reconstruimos desde groupOrderPicks (1.º+2.º de cada grupo + 3.º
  //      de los grupos elegidos en bestThirdGroups)
  const round32 = resolveRoundOf32(team);
  for (let i = 0; i < 32; i++) {
    values.push(escapeCsvCell(round32[i] || ""));
  }

  // D.2) 16 octavos = knockoutPicks.dieciseisavos (los 16 que el usuario eligió
  //      que avanzan FROM dieciseisavos TO octavos)
  const round16 = (team.knockoutPicks?.dieciseisavos || []).map((p) => p.country);
  for (let i = 0; i < 16; i++) {
    values.push(escapeCsvCell(round16[i] || ""));
  }

  // D.3) 8 cuartos = knockoutPicks.octavos
  const quarters = (team.knockoutPicks?.octavos || []).map((p) => p.country);
  for (let i = 0; i < 8; i++) {
    values.push(escapeCsvCell(quarters[i] || ""));
  }

  // D.4) 4 semifinales = knockoutPicks.cuartos
  const semis = (team.knockoutPicks?.cuartos || []).map((p) => p.country);
  for (let i = 0; i < 4; i++) {
    values.push(escapeCsvCell(semis[i] || ""));
  }

  // D.5) 2 finales = knockoutPicks.final si existe; fallback knockoutPicks.semis
  const finalPicks = team.knockoutPicks?.final && team.knockoutPicks.final.length > 0
    ? team.knockoutPicks.final.map((p) => p.country)
    : (team.knockoutPicks?.semis || []).map((p) => p.country);
  for (let i = 0; i < 2; i++) {
    values.push(escapeCsvCell(finalPicks[i] || ""));
  }

  // E) Podio
  values.push(escapeCsvCell(team.championPick || ""));
  values.push(escapeCsvCell(team.runnerUpPick || ""));
  values.push(escapeCsvCell(team.thirdPlacePick || ""));

  // F) 10 especiales
  const sp = team.specials || ({} as Team["specials"]);
  values.push(escapeCsvCell(sp.mejorJugador || ""));
  values.push(escapeCsvCell(sp.mejorJoven || ""));
  values.push(escapeCsvCell(sp.mejorPortero || ""));
  values.push(escapeCsvCell(sp.maxGoleador || ""));
  values.push(escapeCsvCell(sp.maxAsistente || ""));
  values.push(escapeCsvCell(sp.maxGoleadorEsp || ""));
  values.push(escapeCsvCell(sp.primerGolEsp || ""));
  values.push(escapeCsvCell(sp.revelacion || ""));
  values.push(escapeCsvCell(sp.decepcion || ""));
  values.push(escapeCsvCell(
    typeof sp.minutoPrimerGol === "number" ? sp.minutoPrimerGol : "",
  ));

  return values;
}

// ── Reconstrucción del round32: 1.º+2.º de cada grupo + 3.º de bestThirdGroups ──
function resolveRoundOf32(team: Team): string[] {
  // Si el modelo de datos guarda explícitamente roundOf32Teams, usarlo
  if (Array.isArray(team.roundOf32Teams) && team.roundOf32Teams.length > 0) {
    return team.roundOf32Teams;
  }
  const result: string[] = [];
  const seen = new Set<string>();
  for (const group of Object.keys(GROUPS)) {
    const picks = team.groupOrderPicks?.[group] || [];
    for (let i = 0; i < 2; i++) {
      if (picks[i] && !seen.has(picks[i])) {
        result.push(picks[i]);
        seen.add(picks[i]);
      }
    }
  }
  for (const group of (team.bestThirdGroups || [])) {
    const picks = team.groupOrderPicks?.[group] || [];
    if (picks[2] && !seen.has(picks[2])) {
      result.push(picks[2]);
      seen.add(picks[2]);
    }
  }
  return result;
}

// ════════════════════════════════════════════════════════════════════════════
// API pública — mismas firmas que antes para evitar tocar el botón en mi-club
// ════════════════════════════════════════════════════════════════════════════

/**
 * Construye el CSV para la porra dada con el esquema de 269 columnas.
 *
 * @param team Porra a exportar.
 * @param _adminResults Mantenido por compatibilidad con la firma previa.
 *                      No se usa: el nuevo esquema no incluye datos de admin
 *                      ni cálculos de puntos.
 * @returns CSV con dos líneas: header + valores.
 */
export function buildTeamCsv(team: Team, _adminResults?: AdminResults): string {
  // Sanity check en dev: el array de headers debe tener 269 elementos
  if (process.env.NODE_ENV !== "production" && CSV_TEMPLATE_HEADERS.length !== 269) {
    // eslint-disable-next-line no-console
    console.warn(
      `[export-team-csv] CSV_TEMPLATE_HEADERS tiene ${CSV_TEMPLATE_HEADERS.length} elementos, se esperaban 269`,
    );
  }

  const headerLine = CSV_TEMPLATE_HEADERS.join(",");
  const values = buildRowValues(team);

  // Validación adicional en dev: el número de valores debe coincidir con el de headers
  if (process.env.NODE_ENV !== "production" && values.length !== CSV_TEMPLATE_HEADERS.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[export-team-csv] Mismatch: ${values.length} valores vs ${CSV_TEMPLATE_HEADERS.length} headers`,
    );
  }

  const valueLine = values.join(",");
  return `${headerLine}\n${valueLine}`;
}

/** Genera un nombre de archivo seguro para la descarga. */
export function buildTeamCsvFilename(team: Team): string {
  const safeName = (team.name || "porra")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || "porra";
  const safeUser = (team.username || "user")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .toLowerCase() || "user";
  return `${safeUser}_${safeName}.csv`;
}
