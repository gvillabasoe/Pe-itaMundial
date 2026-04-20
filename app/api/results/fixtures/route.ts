import { NextResponse } from "next/server";
import { normalizeName } from "@/lib/data";
import { normalizeCity } from "@/lib/config/regions";
import type { MatchStage } from "@/lib/worldcup/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const API_BASE = "https://v3.football.api-sports.io";
const WORLD_CUP_LEAGUE_ID = 1;
const WORLD_CUP_SEASON = 2026;
const LIVE_STATUS_FILTER = "1H-HT-2H-ET-P-BT-LIVE";
const LIVE_BATCH_SIZE = 20;
const API_TIMEOUT_MS = 10000;

interface RawApiFixture {
  fixture?: {
    id?: number;
    date?: string;
    status?: {
      short?: string;
      elapsed?: number | null;
    };
    venue?: {
      city?: string | null;
    };
  };
  league?: {
    round?: string;
  };
  teams?: {
    home?: { name?: string };
    away?: { name?: string };
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  };
}

interface RawCoveragePayload {
  response?: Array<{
    seasons?: Array<{
      coverage?: {
        fixtures?: {
          events?: boolean;
          lineups?: boolean;
          statistics_fixtures?: boolean;
          statistics_players?: boolean;
        };
      };
    }>;
  }>;
}

export interface ApiFixtureItem {
  apiId: number | null;
  stage: MatchStage;
  roundLabel: string;
  competitionLabel?: string | null;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  minute: number | null;
  statusShort: string;
  city: string | null;
  score: { home: number | null; away: number | null };
}

function mapRoundToStage(roundLabel: string): MatchStage {
  const round = roundLabel.toLowerCase();
  if (round.includes("semi")) return "semi-final";
  if (round.includes("third") || round.includes("3rd")) return "third-place";
  if (round.includes("quarter") || round.includes("1/4")) return "quarter-final";
  if (round.includes("group")) return "group";
  if (round.includes("1/16") || round.includes("round of 32") || round.includes("sixteenth")) return "round-of-32";
  if (round.includes("1/8") || round.includes("round of 16") || round.includes("eighth")) return "round-of-16";
  if (round.includes("final")) return "final";
  return "group";
}

function sortFixtures(fixtures: ApiFixtureItem[]) {
  return [...fixtures].sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
}

function getApiKey(): string | null {
  return (
    process.env.API_SPORTS_KEY ||
    process.env.API_FOOTBALL_KEY ||
    process.env.APISPORTS_KEY ||
    process.env.X_APISPORTS_KEY ||
    null
  );
}

function extractResponseArray(payload: unknown): RawApiFixture[] {
  return Array.isArray((payload as { response?: unknown[] } | null | undefined)?.response)
    ? ((payload as { response?: RawApiFixture[] }).response || [])
    : [];
}

async function fetchApiJson(path: string, apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "x-apisports-key": apiKey,
        accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`API request failed with ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("API request timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchCoverage(apiKey: string) {
  const payload = (await fetchApiJson(
    `/leagues?id=${WORLD_CUP_LEAGUE_ID}&season=${WORLD_CUP_SEASON}`,
    apiKey
  )) as RawCoveragePayload;

  const season = payload.response?.[0]?.seasons?.find((entry) => Boolean(entry.coverage));
  return season?.coverage || null;
}

function mapWorldCupFixture(item: RawApiFixture): ApiFixtureItem {
  const fixture = item?.fixture;
  const league = item?.league;
  const teams = item?.teams;
  const goals = item?.goals;
  const status = fixture?.status;

  const homeTeam = normalizeName((teams?.home?.name as string) || "");
  const awayTeam = normalizeName((teams?.away?.name as string) || "");
  const roundLabel = (league?.round as string) || "";

  return {
    apiId: typeof fixture?.id === "number" ? fixture.id : null,
    stage: mapRoundToStage(roundLabel),
    roundLabel,
    competitionLabel: null,
    homeTeam,
    awayTeam,
    kickoff: (fixture?.date as string) || new Date().toISOString(),
    minute: typeof status?.elapsed === "number" ? status.elapsed : null,
    statusShort: (status?.short as string) || "NS",
    city: normalizeCity((fixture?.venue?.city as string) || null),
    score: {
      home: typeof goals?.home === "number" ? goals.home : null,
      away: typeof goals?.away === "number" ? goals.away : null,
    },
  };
}

function buildCalendarPayload(connection: "calendar" | "error", error?: string) {
  return {
    source: "calendar",
    connection,
    updatedAt: new Date().toISOString(),
    fixtures: [] as ApiFixtureItem[],
    ...(error ? { error } : {}),
  };
}

function chunkIds(ids: number[], size: number) {
  const chunks: number[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

async function fetchWorldCupSchedule(apiKey: string): Promise<ApiFixtureItem[]> {
  const payload = await fetchApiJson(`/fixtures?league=${WORLD_CUP_LEAGUE_ID}&season=${WORLD_CUP_SEASON}`, apiKey);
  return extractResponseArray(payload).map(mapWorldCupFixture);
}

async function fetchLiveWorldCupFixtures(apiKey: string, canUseBatchDetails: boolean): Promise<ApiFixtureItem[]> {
  const payload = await fetchApiJson(
    `/fixtures?league=${WORLD_CUP_LEAGUE_ID}&season=${WORLD_CUP_SEASON}&status=${LIVE_STATUS_FILTER}`,
    apiKey
  );

  const liveList = extractResponseArray(payload).map(mapWorldCupFixture);
  const liveIds = liveList
    .map((item) => item.apiId)
    .filter((value): value is number => typeof value === "number");

  if (liveIds.length === 0) {
    return [];
  }

  if (!canUseBatchDetails) {
    return liveList;
  }

  const detailPayloads = await Promise.all(
    chunkIds(liveIds, LIVE_BATCH_SIZE).map((batch) => fetchApiJson(`/fixtures?ids=${batch.join("-")}`, apiKey))
  );

  return detailPayloads.flatMap((detailPayload) => extractResponseArray(detailPayload).map(mapWorldCupFixture));
}

function mergeScheduleWithLive(schedule: ApiFixtureItem[], liveFixtures: ApiFixtureItem[]) {
  if (liveFixtures.length === 0) return schedule;

  const liveByApiId = new Map<number, ApiFixtureItem>();
  liveFixtures.forEach((fixture) => {
    if (typeof fixture.apiId === "number") {
      liveByApiId.set(fixture.apiId, fixture);
    }
  });

  return schedule.map((fixture) => {
    if (typeof fixture.apiId !== "number") return fixture;
    return liveByApiId.get(fixture.apiId) || fixture;
  });
}

export async function GET() {
  const apiKey = getApiKey();

  if (!apiKey) {
    return NextResponse.json(buildCalendarPayload("calendar"), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }

  const errors: string[] = [];

  let coverage: Awaited<ReturnType<typeof fetchCoverage>> = null;
  try {
    coverage = await fetchCoverage(apiKey);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "World Cup coverage API error");
  }

  let scheduleFixtures: ApiFixtureItem[] = [];
  try {
    scheduleFixtures = await fetchWorldCupSchedule(apiKey);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "World Cup schedule API error");
  }

  let liveFixtures: ApiFixtureItem[] = [];
  if (scheduleFixtures.length > 0) {
    try {
      const canUseBatchDetails = Boolean(
        coverage?.fixtures?.events ||
          coverage?.fixtures?.lineups ||
          coverage?.fixtures?.statistics_fixtures ||
          coverage?.fixtures?.statistics_players
      );
      liveFixtures = await fetchLiveWorldCupFixtures(apiKey, canUseBatchDetails);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Live World Cup API error");
    }
  }

  if (scheduleFixtures.length > 0) {
    return NextResponse.json(
      {
        source: "api-football",
        connection: "live",
        updatedAt: new Date().toISOString(),
        fixtures: sortFixtures(mergeScheduleWithLive(scheduleFixtures, liveFixtures)),
        ...(errors.length ? { error: errors.join(" | ") } : {}),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  if (errors.length > 0) {
    return NextResponse.json(buildCalendarPayload("error", errors.join(" | ")), {
      status: 500,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }

  return NextResponse.json(buildCalendarPayload("calendar"), {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
