import { NextResponse } from "next/server";
import { WORLD_CUP_MATCHES, type MatchStage } from "@/lib/worldcup/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ════════════════════════════════════════════════════════════
// API de resultados — proxy a API-Football con fallback robusto
// al calendario oficial. Siempre devuelve 200 con shape consistente,
// los errores se reportan en el campo `connection: "error"` + `error`.
// ════════════════════════════════════════════════════════════

const API_TIMEOUT_MS = 10_000;
const API_BASE = "https://v3.football.api-sports.io";
const WORLD_CUP_LEAGUE_ID = 1; // FIFA World Cup
const SEASON = 2026;

interface ApiFixtureItem {
  apiId: number | null;
  stage: MatchStage;
  roundLabel: string;
  competitionLabel: string | null;
  homeTeam: string;
  awayTeam: string;
  kickoff: string; // ISO 8601 UTC
  minute: number | null;
  statusShort: string;
  city: string | null;
  score: { home: number | null; away: number | null };
}

interface ResultsApiPayload {
  source: "api-football" | "calendar";
  connection: "live" | "calendar" | "error";
  updatedAt: string;
  fixtures: ApiFixtureItem[];
  error?: string;
}

function jsonResponse(payload: ResultsApiPayload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

// Calendario oficial como fuente única de verdad cuando no hay API key
// o la API no responde. Convierte WORLD_CUP_MATCHES al shape de respuesta.
function buildCalendarFallback(): ApiFixtureItem[] {
  return WORLD_CUP_MATCHES.map((match) => ({
    apiId: null,
    stage: match.stage,
    roundLabel: match.roundLabel,
    competitionLabel: null,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    kickoff: match.kickoff,
    minute: null,
    statusShort: "NS",
    city: match.hostCity ?? null,
    score: { home: null, away: null },
  }));
}

function mapRoundToStage(roundLabel: string): MatchStage {
  const r = roundLabel.toLowerCase();
  // IMPORTANTE: comprobar primero "round of 16" antes que "round of 32"
  // para evitar falsos positivos por subcadenas.
  if (r.includes("final") && !r.includes("semi") && !r.includes("quarter") && !r.includes("3rd") && !r.includes("third")) return "final";
  if (r.includes("3rd") || r.includes("third place") || r.includes("tercer")) return "third-place";
  if (r.includes("semi")) return "semi-final";
  if (r.includes("quarter") || r.includes("1/4")) return "quarter-final";
  if (r.includes("round of 16") || r.includes("1/8")) return "round-of-16";
  if (r.includes("round of 32") || r.includes("1/16")) return "round-of-32";
  return "group";
}

// Llamada a API-Football con timeout. Devuelve null si no hay key o falla.
async function fetchFromApiFootball(apiKey: string): Promise<ApiFixtureItem[] | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${API_BASE}/fixtures?league=${WORLD_CUP_LEAGUE_ID}&season=${SEASON}`,
      {
        headers: {
          "x-apisports-key": apiKey,
          Accept: "application/json",
        },
        signal: controller.signal,
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(`API-Football respondió ${response.status}`);
    }

    const data = await response.json();
    const fixtures = Array.isArray(data?.response) ? data.response : [];

    return fixtures.map((item: Record<string, unknown>): ApiFixtureItem => {
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
        homeTeam: String(home.name || ""),
        awayTeam: String(away.name || ""),
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
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[/api/results/fixtures] API-Football error:", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const apiKey = process.env.API_FOOTBALL_KEY || process.env.API_SPORTS_KEY;
  const updatedAt = new Date().toISOString();

  // Sin API key → devolvemos directamente el calendario oficial
  if (!apiKey) {
    return jsonResponse({
      source: "calendar",
      connection: "calendar",
      updatedAt,
      fixtures: buildCalendarFallback(),
    });
  }

  // Con API key → intentamos la API y caemos al calendario si falla
  const apiFixtures = await fetchFromApiFootball(apiKey);

  if (!apiFixtures || apiFixtures.length === 0) {
    return jsonResponse({
      source: "calendar",
      connection: "error",
      updatedAt,
      fixtures: buildCalendarFallback(),
      error: "No se han podido obtener datos en vivo. Mostrando calendario oficial.",
    });
  }

  return jsonResponse({
    source: "api-football",
    connection: "live",
    updatedAt,
    fixtures: apiFixtures,
  });
}
