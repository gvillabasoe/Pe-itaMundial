import { NextResponse } from "next/server";
import { FIXTURES } from "@/lib/data";
import { WORLD_CUP_MATCHES, type MatchStage, type WorldCupMatch } from "@/lib/worldcup/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ════════════════════════════════════════════════════════════
// API de resultados — proxy a API-Football con fallback robusto
// al calendario oficial. Siempre devuelve 200 con shape consistente.
//
// Importante: WorldCupMatch NO tiene `kickoff`. Las fechas se
// derivan combinando:
//   - FIXTURES (lib/data) para fase de grupos: kickoff por par de equipos
//   - buildIsoSeries() para eliminatorias: secuencia ISO determinista
// ════════════════════════════════════════════════════════════

const API_TIMEOUT_MS = 10_000;
const API_BASE = "https://v3.football.api-sports.io";
const WORLD_CUP_LEAGUE_ID = 1;
const SEASON = 2026;

interface ApiFixtureItem {
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

function normalizeKey(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Construye una serie ISO determinista de kickoffs UTC para una fase.
 */
function buildIsoSeries(startDate: string, hoursUtc: number[], count: number): string[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const values: string[] = [];
  let h = 0;
  let d = 0;
  for (let i = 0; i < count; i += 1) {
    const slot = new Date(start);
    slot.setUTCDate(start.getUTCDate() + d);
    slot.setUTCHours(hoursUtc[h], 0, 0, 0);
    values.push(slot.toISOString());
    h += 1;
    if (h >= hoursUtc.length) {
      h = 0;
      d += 1;
    }
  }
  return values;
}

// Index por par de equipos (bidireccional) → kickoff desde FIXTURES
const GROUP_KICKOFF_BY_PAIR = new Map<string, string>();
FIXTURES.forEach((f) => {
  if (!f.kickoff) return;
  const key1 = `${normalizeKey(f.homeTeam)}|${normalizeKey(f.awayTeam)}`;
  const key2 = `${normalizeKey(f.awayTeam)}|${normalizeKey(f.homeTeam)}`;
  GROUP_KICKOFF_BY_PAIR.set(key1, f.kickoff);
  GROUP_KICKOFF_BY_PAIR.set(key2, f.kickoff);
});

const KNOCKOUT_FALLBACKS: Record<Exclude<MatchStage, "group">, string[]> = {
  "round-of-32": buildIsoSeries("2026-06-28", [16, 19], 16),
  "round-of-16": buildIsoSeries("2026-07-06", [16, 19], 8),
  "quarter-final": buildIsoSeries("2026-07-11", [16, 19], 4),
  "semi-final": buildIsoSeries("2026-07-15", [19], 2),
  "third-place": buildIsoSeries("2026-07-18", [18], 1),
  final: buildIsoSeries("2026-07-19", [19], 1),
};

const KNOCKOUT_KICKOFF_BY_ID = new Map<number, string>();
(Object.keys(KNOCKOUT_FALLBACKS) as Array<Exclude<MatchStage, "group">>).forEach((stage) => {
  WORLD_CUP_MATCHES.filter((m) => m.stage === stage).forEach((m, i) => {
    KNOCKOUT_KICKOFF_BY_ID.set(m.id, KNOCKOUT_FALLBACKS[stage][i]);
  });
});

function getKickoffForMatch(match: WorldCupMatch): string {
  if (match.stage === "group") {
    const key = `${normalizeKey(match.homeTeam)}|${normalizeKey(match.awayTeam)}`;
    return GROUP_KICKOFF_BY_PAIR.get(key) || "2026-06-11T19:00:00.000Z";
  }
  return KNOCKOUT_KICKOFF_BY_ID.get(match.id) || "2026-07-19T19:00:00.000Z";
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
  const apiKey =
    process.env.API_FOOTBALL_KEY ||
    process.env.API_SPORTS_KEY ||
    process.env.APISPORTS_KEY ||
    process.env.X_APISPORTS_KEY;
  const updatedAt = new Date().toISOString();

  if (!apiKey) {
    return jsonResponse({
      source: "calendar",
      connection: "calendar",
      updatedAt,
      fixtures: buildCalendarFallback(),
    });
  }

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
