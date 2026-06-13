// ════════════════════════════════════════════════════════════
// Proveedores de datos en vivo del Mundial (extraído de
// app/api/results/fixtures/route.ts para poder reutilizarlo desde
// /api/admin-results). La caché en memoria es COMPARTIDA por ambos
// endpoints, así que activar el modo automático no añade peticiones
// extra a los proveedores.
// ════════════════════════════════════════════════════════════
import { WORLD_CUP_MATCHES, type MatchStage, type WorldCupMatch } from "@/lib/worldcup/schedule";
import { getKickoffByMatchId } from "@/lib/worldcup/kickoffs";
import { normalizeName } from "@/lib/data";

// ════════════════════════════════════════════════════════════
// API de resultados — proxy con fallback robusto al calendario.
// Siempre devuelve 200 con shape consistente.
//
// Proveedores (en orden):
//   1. API-Football  (API_FOOTBALL_KEY / API_SPORTS_KEY...)
//      - Soporta keys directas de api-sports.io Y keys de RapidAPI
//        (se detecta automáticamente y se reintenta con el host correcto).
//      - OJO: el plan FREE de API-Football NO incluye la temporada 2026.
//        Si ese es tu caso, el error real ahora se muestra en el campo
//        `error` de la respuesta en vez de fallar en silencio.
//   2. football-data.org (FOOTBALL_DATA_KEY)
//      - Su plan GRATUITO sí incluye el Mundial 2026 (competición WC).
//        Crea tu key en https://www.football-data.org/client/register
//   3. ESPN (sin key, sin registro, sin trial) — SIEMPRE disponible
//      - API pública no oficial que alimenta espn.com, con datos en
//        tiempo real del Mundial 2026. No hay que configurar nada: si
//        no hay ninguna key, la app se conecta sola por esta vía.
//
// Las fechas/horas de los partidos provienen del calendario oficial de
// horarios (lib/worldcup/kickoffs), indexado por id de partido. La API solo
// aporta marcador/estado en vivo.
//
// Los nombres de equipo de las APIs (en inglés) se normalizan al español
// con normalizeName() para que el merge por pareja de equipos del frontend
// (app/resultados/page.tsx) encuentre los partidos de fase de grupos.
// ════════════════════════════════════════════════════════════

const API_TIMEOUT_MS = 10_000;
const API_BASE = "https://v3.football.api-sports.io";
const RAPIDAPI_BASE = "https://api-football-v1.p.rapidapi.com/v3";
const RAPIDAPI_HOST = "api-football-v1.p.rapidapi.com";
const FOOTBALL_DATA_BASE = "https://api.football-data.org/v4";
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
// Rango completo del torneo (11 jun – 19 jul) + margen, para recibir
// también los resultados finales de partidos ya jugados.
const ESPN_DATE_RANGE = "20260611-20260721";
const WORLD_CUP_LEAGUE_ID = 1;
const SEASON = 2026;

// Caché en memoria (por instancia) para no agotar las cuotas gratuitas
// (football-data: 10 req/min; API-Football free: 100 req/día). El frontend
// refresca cada 30s por usuario, así que sin caché varias personas a la vez
// agotarían el límite y la conexión "se caería" sola.
const CACHE_TTL_MS = 25_000;
let cachedPayload: ResultsApiPayload | null = null;
let cachedUntil = 0;

export interface ApiGoalEvent {
  /** Minuto del gol (null si no se pudo parsear) */
  minute: number | null;
  /** Nombre del jugador tal como lo da el proveedor */
  player: string;
  /** Lado que SUMA el gol en el marcador ("home"/"away" del calendario del proveedor) */
  side: "home" | "away";
  ownGoal: boolean;
  penalty: boolean;
}

export interface ApiFixtureItem {
  apiId: number | null;
  stage: MatchStage;
  roundLabel: string;
  competitionLabel: string | null;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  minute: number | null;
  statusShort: string;
  city: string | null;
  score: { home: number | null; away: number | null };
  /** Goleadores (solo disponible vía ESPN; vacío en otros proveedores) */
  goals?: ApiGoalEvent[];
}

export interface ResultsApiPayload {
  source: "api-football" | "football-data" | "espn" | "calendar";
  connection: "live" | "calendar" | "error";
  updatedAt: string;
  fixtures: ApiFixtureItem[];
  error?: string;
}

function getKickoffForMatch(match: WorldCupMatch): string {
  return getKickoffByMatchId(match.id);
}

function buildCalendarFallback(): ApiFixtureItem[] {
  return WORLD_CUP_MATCHES.map((match) => ({
    apiId: null,
    stage: match.stage,
    roundLabel: match.roundLabel,
    competitionLabel: null,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    kickoff: getKickoffForMatch(match),
    minute: null,
    statusShort: "NS",
    city: match.hostCity ?? null,
    score: { home: null, away: null },
  }));
}

// Aliases no cubiertos por NAME_NORMALIZATION (lib/data.ts)
const EXTRA_NAME_ALIASES: Record<string, string> = {
  "Türkiye": "Turquía",
  "Turkiye": "Turquía",
  "Korea DPR": "Corea del Sur", // defensivo; no debería aparecer
};

function toSpanishTeamName(raw: string): string {
  const name = raw.trim();
  if (!name) return name;
  return EXTRA_NAME_ALIASES[name] || normalizeName(name);
}

function mapRoundToStage(roundLabel: string): MatchStage {
  const r = roundLabel.toLowerCase();
  if (r.includes("3rd") || r.includes("third place") || r.includes("tercer")) return "third-place";
  if (r.includes("semi")) return "semi-final";
  if (r.includes("quarter") || r.includes("1/4")) return "quarter-final";
  if (r.includes("round of 16") || r.includes("1/8") || r.includes("eighth")) return "round-of-16";
  if (r.includes("round of 32") || r.includes("1/16") || r.includes("sixteenth")) return "round-of-32";
  if (r.includes("group")) return "group";
  if (r.includes("final")) return "final";
  return "group";
}

// ════════════════════════════════════════════════════════════
// PROVEEDOR 1 · API-Football (api-sports.io / RapidAPI)
// ════════════════════════════════════════════════════════════

interface ApiFootballAttemptResult {
  fixtures: ApiFixtureItem[] | null;
  /** Mensaje legible del fallo (si lo hubo) */
  error: string | null;
  /** true si el fallo parece de autenticación (key inválida para este host) */
  authError: boolean;
}

function extractApiFootballErrors(data: unknown): string | null {
  // API-Football devuelve 200 OK con un objeto `errors` cuando algo falla
  // (p.ej. "Free plans do not have access to this season"). El código
  // anterior ignoraba ese campo y el error quedaba invisible.
  const errors = (data as Record<string, unknown> | null)?.errors;
  if (!errors) return null;
  if (Array.isArray(errors)) {
    return errors.length ? errors.map(String).join(" | ") : null;
  }
  if (typeof errors === "object") {
    const entries = Object.entries(errors as Record<string, unknown>);
    if (!entries.length) return null;
    return entries.map(([k, v]) => `${k}: ${String(v)}`).join(" | ");
  }
  return null;
}

async function attemptApiFootball(
  apiKey: string,
  useRapidApi: boolean
): Promise<ApiFootballAttemptResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  const base = useRapidApi ? RAPIDAPI_BASE : API_BASE;
  const headers: Record<string, string> = useRapidApi
    ? { "x-rapidapi-key": apiKey, "x-rapidapi-host": RAPIDAPI_HOST, Accept: "application/json" }
    : { "x-apisports-key": apiKey, Accept: "application/json" };

  try {
    const response = await fetch(
      `${base}/fixtures?league=${WORLD_CUP_LEAGUE_ID}&season=${SEASON}`,
      { headers, signal: controller.signal, cache: "no-store" }
    );

    if (!response.ok) {
      const authError = [401, 403, 499].includes(response.status);
      return {
        fixtures: null,
        error: `API-Football respondió ${response.status}`,
        authError,
      };
    }

    const data = await response.json();

    const bodyError = extractApiFootballErrors(data);
    if (bodyError) {
      const lower = bodyError.toLowerCase();
      const authError = lower.includes("token") || lower.includes("key");
      return { fixtures: null, error: `API-Football: ${bodyError}`, authError };
    }

    const fixtures = Array.isArray(data?.response) ? data.response : [];
    if (fixtures.length === 0) {
      return { fixtures: [], error: null, authError: false };
    }

    const mapped = fixtures.map((item: Record<string, unknown>): ApiFixtureItem => {
      const fixture = (item.fixture || {}) as Record<string, unknown>;
      const teams = (item.teams || {}) as Record<string, Record<string, unknown>>;
      const goals = (item.goals || {}) as Record<string, unknown>;
      const league = (item.league || {}) as Record<string, unknown>;
      const status = (fixture.status || {}) as Record<string, unknown>;
      const venue = (fixture.venue || {}) as Record<string, unknown>;

      const home = teams.home || {};
      const away = teams.away || {};

      return {
        apiId: typeof fixture.id === "number" ? fixture.id : null,
        stage: mapRoundToStage(String(league.round || "")),
        roundLabel: String(league.round || ""),
        competitionLabel: typeof league.name === "string" ? league.name : null,
        homeTeam: toSpanishTeamName(String(home.name || "")),
        awayTeam: toSpanishTeamName(String(away.name || "")),
        kickoff: String(fixture.date || ""),
        minute: typeof status.elapsed === "number" ? status.elapsed : null,
        statusShort: String(status.short || "NS"),
        city: typeof venue.city === "string" ? venue.city : null,
        score: {
          home: typeof goals.home === "number" ? goals.home : null,
          away: typeof goals.away === "number" ? goals.away : null,
        },
      };
    });

    return { fixtures: mapped, error: null, authError: false };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[/api/results/fixtures] API-Football error:", error);
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "API-Football: timeout (10s)"
        : `API-Football: ${error instanceof Error ? error.message : "error de red"}`;
    return { fixtures: null, error: message, authError: false };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFromApiFootball(
  apiKey: string
): Promise<{ fixtures: ApiFixtureItem[] | null; error: string | null }> {
  // 1º intento: host directo de api-sports.io (key del dashboard oficial)
  const direct = await attemptApiFootball(apiKey, false);
  if (direct.fixtures && direct.fixtures.length > 0) {
    return { fixtures: direct.fixtures, error: null };
  }

  // Si la key parece de RapidAPI (el host directo la rechaza), reintentamos
  // automáticamente contra el host de RapidAPI con sus cabeceras.
  if (direct.authError) {
    const viaRapid = await attemptApiFootball(apiKey, true);
    if (viaRapid.fixtures && viaRapid.fixtures.length > 0) {
      return { fixtures: viaRapid.fixtures, error: null };
    }
    return {
      fixtures: null,
      error: viaRapid.error || direct.error || "API-Football: sin datos",
    };
  }

  if (direct.fixtures && direct.fixtures.length === 0) {
    return { fixtures: null, error: "API-Football: 0 partidos devueltos para league=1&season=2026" };
  }

  return { fixtures: null, error: direct.error };
}

// ════════════════════════════════════════════════════════════
// PROVEEDOR 2 · football-data.org (plan gratuito incluye el Mundial)
// ════════════════════════════════════════════════════════════

function mapFootballDataStage(stage: string): MatchStage {
  const s = stage.toUpperCase();
  if (s.includes("GROUP")) return "group";
  if (s.includes("32")) return "round-of-32";
  if (s.includes("16")) return "round-of-16";
  if (s.includes("QUARTER")) return "quarter-final";
  if (s.includes("SEMI")) return "semi-final";
  if (s.includes("THIRD")) return "third-place";
  if (s.includes("FINAL")) return "final";
  return "group";
}

function mapFootballDataStatus(
  status: string,
  minute: number | null,
  duration: string
): string {
  switch (status) {
    case "SCHEDULED":
    case "TIMED":
      return "NS";
    case "IN_PLAY":
      if (typeof minute === "number" && minute > 90) return "ET";
      if (typeof minute === "number" && minute > 45) return "2H";
      return "1H";
    case "PAUSED":
      return "HT";
    case "FINISHED":
    case "AWARDED":
      if (duration === "PENALTY_SHOOTOUT") return "PEN";
      if (duration === "EXTRA_TIME") return "AET";
      return "FT";
    case "SUSPENDED":
      return "SUSP";
    case "POSTPONED":
      return "PST";
    case "CANCELLED":
      return "CANC";
    default:
      return "NS";
  }
}

const FD_STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: "Fase de Grupos",
  LAST_32: "Round of 32",
  LAST_16: "Round of 16",
  QUARTER_FINALS: "Quarter-finals",
  SEMI_FINALS: "Semi-finals",
  THIRD_PLACE: "3rd Place Final",
  FINAL: "Final",
};

async function fetchFromFootballData(
  apiKey: string
): Promise<{ fixtures: ApiFixtureItem[] | null; error: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`${FOOTBALL_DATA_BASE}/competitions/WC/matches`, {
      headers: { "X-Auth-Token": apiKey, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      let detail = `respondió ${response.status}`;
      try {
        const body = await response.json();
        if (body?.message) detail = `${response.status}: ${String(body.message)}`;
      } catch {
        // sin cuerpo JSON
      }
      return { fixtures: null, error: `football-data.org ${detail}` };
    }

    const data = await response.json();
    const matches = Array.isArray(data?.matches) ? data.matches : [];
    if (matches.length === 0) {
      return { fixtures: null, error: "football-data.org: 0 partidos devueltos" };
    }

    const mapped = matches.map((item: Record<string, unknown>): ApiFixtureItem => {
      const homeTeam = (item.homeTeam || {}) as Record<string, unknown>;
      const awayTeam = (item.awayTeam || {}) as Record<string, unknown>;
      const score = (item.score || {}) as Record<string, unknown>;
      const fullTime = (score.fullTime || {}) as Record<string, unknown>;

      const stageRaw = String(item.stage || "");
      const status = String(item.status || "SCHEDULED");
      const minute = typeof item.minute === "number" ? item.minute : null;
      const duration = String(score.duration || "REGULAR");
      const isLiveOrDone = !["SCHEDULED", "TIMED", "POSTPONED", "CANCELLED"].includes(status);

      return {
        apiId: typeof item.id === "number" ? item.id : null,
        stage: mapFootballDataStage(stageRaw),
        roundLabel: FD_STAGE_LABELS[stageRaw] || stageRaw,
        competitionLabel: "FIFA World Cup",
        homeTeam: toSpanishTeamName(String(homeTeam.name || homeTeam.shortName || "")),
        awayTeam: toSpanishTeamName(String(awayTeam.name || awayTeam.shortName || "")),
        kickoff: String(item.utcDate || ""),
        minute,
        statusShort: mapFootballDataStatus(status, minute, duration),
        city: null,
        score: {
          home: isLiveOrDone && typeof fullTime.home === "number" ? fullTime.home : null,
          away: isLiveOrDone && typeof fullTime.away === "number" ? fullTime.away : null,
        },
      };
    });

    return { fixtures: mapped, error: null };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[/api/results/fixtures] football-data error:", error);
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "football-data.org: timeout (10s)"
        : `football-data.org: ${error instanceof Error ? error.message : "error de red"}`;
    return { fixtures: null, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

// ════════════════════════════════════════════════════════════
// PROVEEDOR 3 · ESPN (sin key, sin registro, sin trial)
//
// API pública no oficial de espn.com. Devuelve los partidos del Mundial
// 2026 en tiempo real (liga "fifa.world"). Estructura por evento:
//   { date, season: { slug }, competitions: [{ status, venue,
//     competitors: [{ homeAway, score, team: { displayName } }] }] }
// ════════════════════════════════════════════════════════════

// Ventanas de fechas oficiales por fase (fallback si el slug no es claro)
const ESPN_STAGE_WINDOWS: Array<{ until: string; stage: MatchStage; label: string }> = [
  { until: "2026-06-28T06:59Z", stage: "group", label: "Fase de Grupos" },
  { until: "2026-07-04T06:59Z", stage: "round-of-32", label: "Round of 32" },
  { until: "2026-07-09T06:59Z", stage: "round-of-16", label: "Round of 16" },
  { until: "2026-07-14T06:59Z", stage: "quarter-final", label: "Quarter-finals" },
  { until: "2026-07-17T06:59Z", stage: "semi-final", label: "Semi-finals" },
  { until: "2026-07-19T06:59Z", stage: "third-place", label: "3rd Place Final" },
  { until: "2026-08-01T06:59Z", stage: "final", label: "Final" },
];

function mapEspnStage(slug: string, kickoffIso: string): { stage: MatchStage; label: string } {
  const s = slug.toLowerCase();
  if (s.includes("group")) return { stage: "group", label: "Fase de Grupos" };
  if (s.includes("32")) return { stage: "round-of-32", label: "Round of 32" };
  if (s.includes("16")) return { stage: "round-of-16", label: "Round of 16" };
  if (s.includes("quarter")) return { stage: "quarter-final", label: "Quarter-finals" };
  if (s.includes("semi")) return { stage: "semi-final", label: "Semi-finals" };
  if (s.includes("third") || s.includes("3rd")) return { stage: "third-place", label: "3rd Place Final" };
  if (s.includes("final")) return { stage: "final", label: "Final" };

  // Fallback por fecha (ventanas del calendario oficial)
  const t = Date.parse(kickoffIso);
  for (const window of ESPN_STAGE_WINDOWS) {
    if (Number.isFinite(t) && t < Date.parse(window.until)) {
      return { stage: window.stage, label: window.label };
    }
  }
  return { stage: "group", label: "Fase de Grupos" };
}

function parseEspnMinute(displayClock: string): number | null {
  // displayClock viene como "67'", "45'+2", "90'+4"...
  const match = /^(\d+)/.exec(displayClock.trim());
  if (!match) return null;
  const minute = parseInt(match[1], 10);
  return Number.isFinite(minute) ? minute : null;
}

function mapEspnStatus(
  typeName: string,
  state: string,
  minute: number | null
): string {
  const name = typeName.toUpperCase();
  if (name.includes("POSTPONED")) return "PST";
  if (name.includes("CANCELED") || name.includes("CANCELLED")) return "CANC";
  if (name.includes("ABANDONED")) return "ABD";
  if (name.includes("SUSPENDED")) return "SUSP";

  if (state === "pre") return "NS";

  if (state === "in") {
    if (name.includes("HALFTIME")) return "HT";
    if (name.includes("SHOOTOUT") || name.includes("PENALT")) return "P";
    if (name.includes("OVERTIME") || name.includes("EXTRA")) return "ET";
    if (typeof minute === "number" && minute > 90) return "ET";
    if (typeof minute === "number" && minute > 45) return "2H";
    return "1H";
  }

  // state === "post"
  if (name.includes("PEN") || name.includes("SHOOTOUT")) return "PEN";
  if (name.includes("AET") || name.includes("OVERTIME") || name.includes("EXTRA")) return "AET";
  return "FT";
}

async function fetchFromEspn(): Promise<{ fixtures: ApiFixtureItem[] | null; error: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${ESPN_BASE}?dates=${ESPN_DATE_RANGE}&limit=400`,
      {
        headers: { Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return { fixtures: null, error: `ESPN respondió ${response.status}` };
    }

    const data = await response.json();
    const events = Array.isArray(data?.events) ? data.events : [];
    if (events.length === 0) {
      return { fixtures: null, error: "ESPN: 0 partidos devueltos" };
    }

    const fixtures: ApiFixtureItem[] = [];

    for (const event of events as Array<Record<string, unknown>>) {
      const competitions = Array.isArray(event.competitions) ? event.competitions : [];
      const competition = (competitions[0] || {}) as Record<string, unknown>;
      const competitors = Array.isArray(competition.competitors) ? competition.competitors : [];

      const homeEntry = (competitors as Array<Record<string, unknown>>).find(
        (c) => c.homeAway === "home"
      );
      const awayEntry = (competitors as Array<Record<string, unknown>>).find(
        (c) => c.homeAway === "away"
      );
      if (!homeEntry || !awayEntry) continue;

      const homeTeamObj = (homeEntry.team || {}) as Record<string, unknown>;
      const awayTeamObj = (awayEntry.team || {}) as Record<string, unknown>;

      const statusObj = (competition.status || event.status || {}) as Record<string, unknown>;
      const statusType = (statusObj.type || {}) as Record<string, unknown>;
      const state = String(statusType.state || "pre");
      const typeName = String(statusType.name || "STATUS_SCHEDULED");

      const minute =
        state === "in" ? parseEspnMinute(String(statusObj.displayClock || "")) : null;

      const kickoff = String(event.date || competition.date || "");
      const seasonObj = (event.season || {}) as Record<string, unknown>;
      const { stage, label } = mapEspnStage(String(seasonObj.slug || ""), kickoff);

      const venue = (competition.venue || {}) as Record<string, unknown>;
      const address = (venue.address || {}) as Record<string, unknown>;

      // Goleadores: el scoreboard de fútbol de ESPN incluye un array
      // \`details\` por partido con goles y tarjetas. Filtramos los goles y
      // los asignamos a local/visitante por el id de equipo del competitor.
      const homeTeamId = String((homeEntry.team as Record<string, unknown>)?.id ?? homeEntry.id ?? "");
      const awayTeamId = String((awayEntry.team as Record<string, unknown>)?.id ?? awayEntry.id ?? "");
      const details = Array.isArray(competition.details) ? competition.details : [];
      const goals: ApiGoalEvent[] = [];
      for (const d of details as Array<Record<string, unknown>>) {
        const type = (d.type || {}) as Record<string, unknown>;
        const typeText = String(type.text || "").toLowerCase();
        const isGoal = d.scoringPlay === true || typeText.includes("goal");
        if (!isGoal) continue;
        if (d.redCard === true || d.yellowCard === true) continue;
        const clock = (d.clock || {}) as Record<string, unknown>;
        const minute = parseEspnMinute(String(clock.displayValue || ""));
        const detailTeam = (d.team || {}) as Record<string, unknown>;
        const detailTeamId = String(detailTeam.id ?? "");
        const ownGoal = d.ownGoal === true || typeText.includes("own goal");
        // En ESPN, team.id del detail es el equipo al que se ACREDITA el gol
        // en el marcador (en gol en propia ya viene acreditado al rival).
        let side: "home" | "away" | null = null;
        if (detailTeamId && detailTeamId === homeTeamId) side = "home";
        else if (detailTeamId && detailTeamId === awayTeamId) side = "away";
        if (!side) continue;
        const involved = Array.isArray(d.athletesInvolved) ? d.athletesInvolved : [];
        const first = (involved[0] || {}) as Record<string, unknown>;
        const player = String(first.displayName || first.shortName || first.fullName || "").trim();
        goals.push({
          minute,
          player: player || "—",
          side,
          ownGoal,
          penalty: d.penaltyKick === true || typeText.includes("penalty"),
        });
      }
      goals.sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999));

      const parseScore = (value: unknown): number | null => {
        const n = typeof value === "string" ? parseInt(value, 10) : typeof value === "number" ? value : NaN;
        return Number.isFinite(n) ? n : null;
      };

      // En partidos no comenzados ESPN manda score "0": lo dejamos a null
      // para no pintar 0-0 en partidos programados.
      const started = state !== "pre";

      const eventId = parseInt(String(event.id || ""), 10);

      fixtures.push({
        apiId: Number.isFinite(eventId) ? eventId : null,
        stage,
        roundLabel: label,
        competitionLabel: "FIFA World Cup",
        homeTeam: toSpanishTeamName(String(homeTeamObj.displayName || homeTeamObj.name || "")),
        awayTeam: toSpanishTeamName(String(awayTeamObj.displayName || awayTeamObj.name || "")),
        kickoff,
        minute,
        statusShort: mapEspnStatus(typeName, state, minute),
        city: typeof address.city === "string" ? address.city : null,
        score: {
          home: started ? parseScore(homeEntry.score) : null,
          away: started ? parseScore(awayEntry.score) : null,
        },
        goals,
      });
    }

    if (fixtures.length === 0) {
      return { fixtures: null, error: "ESPN: respuesta sin partidos válidos" };
    }

    return { fixtures, error: null };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[/api/results/fixtures] ESPN error:", error);
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "ESPN: timeout (10s)"
        : `ESPN: ${error instanceof Error ? error.message : "error de red"}`;
    return { fixtures: null, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

// ════════════════════════════════════════════════════════════
// HANDLER
// ════════════════════════════════════════════════════════════

export async function getLiveFixturesPayload(): Promise<ResultsApiPayload> {
  const now = Date.now();
  if (cachedPayload && now < cachedUntil) {
    return cachedPayload;
  }

  const apiFootballKey =
    process.env.API_FOOTBALL_KEY ||
    process.env.API_SPORTS_KEY ||
    process.env.APISPORTS_KEY ||
    process.env.X_APISPORTS_KEY;
  const footballDataKey = process.env.FOOTBALL_DATA_KEY || process.env.FOOTBALL_DATA_TOKEN;

  const updatedAt = new Date().toISOString();
  const errors: string[] = [];

  // Intento 1 · API-Football
  if (apiFootballKey) {
    const result = await fetchFromApiFootball(apiFootballKey);
    if (result.fixtures && result.fixtures.length > 0) {
      const payload: ResultsApiPayload = {
        source: "api-football",
        connection: "live",
        updatedAt,
        fixtures: result.fixtures,
      };
      cachedPayload = payload;
      cachedUntil = Date.now() + CACHE_TTL_MS;
      return payload;
    }
    if (result.error) errors.push(result.error);
  }

  // Intento 2 · football-data.org
  if (footballDataKey) {
    const result = await fetchFromFootballData(footballDataKey);
    if (result.fixtures && result.fixtures.length > 0) {
      const payload: ResultsApiPayload = {
        source: "football-data",
        connection: "live",
        updatedAt,
        fixtures: result.fixtures,
        ...(errors.length ? { error: errors.join(" · ") } : {}),
      };
      cachedPayload = payload;
      cachedUntil = Date.now() + CACHE_TTL_MS;
      return payload;
    }
    if (result.error) errors.push(result.error);
  }

  // Intento 3 · ESPN — sin key, siempre se intenta como último recurso
  {
    const result = await fetchFromEspn();
    if (result.fixtures && result.fixtures.length > 0) {
      const payload: ResultsApiPayload = {
        source: "espn",
        connection: "live",
        updatedAt,
        fixtures: result.fixtures,
        ...(errors.length ? { error: errors.join(" · ") } : {}),
      };
      cachedPayload = payload;
      cachedUntil = Date.now() + CACHE_TTL_MS;
      return payload;
    }
    if (result.error) errors.push(result.error);
  }

  return {
    source: "calendar",
    connection: "error",
    updatedAt,
    fixtures: buildCalendarFallback(),
    error: errors.length
      ? `No se han podido obtener datos en vivo. ${errors.join(" · ")}`
      : "No se han podido obtener datos en vivo. Mostrando calendario oficial.",
  };
}
