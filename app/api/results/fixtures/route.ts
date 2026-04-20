import { NextResponse } from "next/server";
import { normalizeName } from "@/lib/data";
import { normalizeCity } from "@/lib/config/regions";
import { isLivePollingStatus, isTerminalStatus } from "@/lib/config/match-status";
import type { MatchStage } from "@/lib/worldcup/schedule";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const API_BASE = "https://v3.football.api-sports.io";
const WORLD_CUP_LEAGUE_ID = 1;
const TEST_FIXTURE_LOOKUP = {
  date: "2026-04-20",
  league: 39,
  season: 2025,
  homeTeam: "Crystal Palace",
  awayTeam: "West Ham United",
} as const;
const TEST_FIXTURE_ID_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const TEST_FALLBACK_VISIBLE_MS = 4 * 60 * 60 * 1000;
const TEST_HIDE_AFTER_MS = 2 * 60 * 60 * 1000;
const API_TIMEOUT_MS = 10000;
const FALLBACK_API_SPORTS_KEY = "4efad1513ecd4f716ad4f91fbff82490";

let testFixtureIdCache: { id: number | null; expiresAt: number } | null = null;

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
  supplemental?: boolean;
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
    FALLBACK_API_SPORTS_KEY ||
    null
  );
}

function buildFallbackTestFixture(now = new Date()): ApiFixtureItem | null {
  const kickoff = `${TEST_FIXTURE_LOOKUP.date}T19:00:00Z`;
  const kickoffAt = new Date(kickoff).getTime();

  if (!Number.isNaN(kickoffAt) && now.getTime() >= kickoffAt + TEST_FALLBACK_VISIBLE_MS) {
    return null;
  }

  return {
    apiId: null,
    stage: "final",
    roundLabel: "Final",
    competitionLabel: "Premier League",
    homeTeam: TEST_FIXTURE_LOOKUP.homeTeam,
    awayTeam: TEST_FIXTURE_LOOKUP.awayTeam,
    kickoff,
    minute: null,
    statusShort: "NS",
    city: "London",
    score: { home: null, away: null },
    supplemental: true,
  };
}

function normalizeLooseKey(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function extractResponseArray(payload: unknown): RawApiFixture[] {
  return Array.isArray((payload as { response?: unknown[] } | null | undefined)?.response)
    ? ((payload as { response?: RawApiFixture[] }).response || [])
    : [];
}

function isTestFixtureCandidate(item: RawApiFixture): boolean {
  const homeTeam = normalizeLooseKey(item?.teams?.home?.name);
  const awayTeam = normalizeLooseKey(item?.teams?.away?.name);
  const expectedHome = normalizeLooseKey(TEST_FIXTURE_LOOKUP.homeTeam);
  const expectedAway = normalizeLooseKey(TEST_FIXTURE_LOOKUP.awayTeam);
  const expectedAwayAlt = normalizeLooseKey("West Ham");

  const isDirectMatch = homeTeam === expectedHome && (awayTeam === expectedAway || awayTeam === expectedAwayAlt);
  const isReverseMatch = awayTeam === expectedHome && (homeTeam === expectedAway || homeTeam === expectedAwayAlt);

  return isDirectMatch || isReverseMatch;
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
    supplemental: false,
  };
}

function shouldHideTestFixture(fixture: ApiFixtureItem, now = Date.now()): boolean {
  if (!fixture.supplemental || !isTerminalStatus(fixture.statusShort)) return false;

  const kickoffAt = new Date(fixture.kickoff).getTime();
  if (Number.isNaN(kickoffAt)) return false;

  return now >= kickoffAt + TEST_HIDE_AFTER_MS;
}

function mapTestFixture(item: RawApiFixture): ApiFixtureItem | null {
  const fixture = item?.fixture;
  const teams = item?.teams;
  const goals = item?.goals;
  const status = fixture?.status;

  const rawCity = (fixture?.venue?.city as string | null) || null;

  const mapped: ApiFixtureItem = {
    apiId: typeof fixture?.id === "number" ? fixture.id : null,
    stage: "final",
    roundLabel: "Final",
    competitionLabel: "Premier League",
    homeTeam: TEST_FIXTURE_LOOKUP.homeTeam,
    awayTeam: TEST_FIXTURE_LOOKUP.awayTeam,
    kickoff: (fixture?.date as string) || `${TEST_FIXTURE_LOOKUP.date}T19:00:00Z`,
    minute: typeof status?.elapsed === "number" ? status.elapsed : null,
    statusShort: (status?.short as string) || "NS",
    city: normalizeCity(rawCity) || rawCity,
    score: {
      home: typeof goals?.home === "number" ? goals.home : null,
      away: typeof goals?.away === "number" ? goals.away : null,
    },
    supplemental: true,
  };

  return shouldHideTestFixture(mapped) ? null : mapped;
}

async function resolveTestFixtureId(apiKey: string): Promise<number | null> {
  const now = Date.now();
  if (testFixtureIdCache && testFixtureIdCache.expiresAt > now) {
    return testFixtureIdCache.id;
  }

  const lookupPayload = await fetchApiJson(
    `/fixtures?date=${TEST_FIXTURE_LOOKUP.date}&league=${TEST_FIXTURE_LOOKUP.league}&season=${TEST_FIXTURE_LOOKUP.season}`,
    apiKey
  );

  const candidate = extractResponseArray(lookupPayload).find(isTestFixtureCandidate);
  const resolvedId = typeof candidate?.fixture?.id === "number" ? candidate.fixture.id : null;

  testFixtureIdCache = {
    id: resolvedId,
    expiresAt: now + TEST_FIXTURE_ID_CACHE_TTL_MS,
  };

  return resolvedId;
}

async function fetchTestFixture(apiKey: string): Promise<ApiFixtureItem | null> {
  const fixtureId = await resolveTestFixtureId(apiKey);
  if (!fixtureId) return buildFallbackTestFixture();

  const basePayload = await fetchApiJson(`/fixtures?id=${fixtureId}`, apiKey);
  let selectedFixture = extractResponseArray(basePayload).find(isTestFixtureCandidate) || extractResponseArray(basePayload)[0];

  if (!selectedFixture) return buildFallbackTestFixture();

  const baseStatus = (selectedFixture.fixture?.status?.short as string | undefined) || "NS";
  if (isLivePollingStatus(baseStatus)) {
    try {
      const livePayload = await fetchApiJson(`/fixtures?id=${fixtureId}&live=all`, apiKey);
      const liveFixture = extractResponseArray(livePayload)[0];
      if (liveFixture) {
        selectedFixture = liveFixture;
      }
    } catch {
      // Si live=all falla, conservamos el snapshot base del fixture.
    }
  }

  return mapTestFixture(selectedFixture);
}

async function fetchWorldCupFixtures(apiKey: string): Promise<ApiFixtureItem[]> {
  const payload = await fetchApiJson(`/fixtures?league=${WORLD_CUP_LEAGUE_ID}&season=2026`, apiKey);
  return extractResponseArray(payload).map(mapWorldCupFixture);
}

function buildCalendarPayload(connection: "calendar" | "error", error?: string) {
  const fallbackTestFixture = buildFallbackTestFixture();

  return {
    source: connection === "calendar" ? "calendar" : "api-football",
    connection,
    updatedAt: new Date().toISOString(),
    fixtures: fallbackTestFixture ? [fallbackTestFixture] : [],
    ...(error ? { error } : {}),
  };
}

export async function GET() {
  const apiKey = getApiKey();

  if (!apiKey) {
    return NextResponse.json(buildCalendarPayload("calendar"), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }

  const settled = await Promise.allSettled([
    fetchWorldCupFixtures(apiKey),
    fetchTestFixture(apiKey),
  ]);

  const errors: string[] = [];
  const worldCupFixtures = settled[0].status === "fulfilled"
    ? settled[0].value
    : (() => {
        errors.push(settled[0].reason instanceof Error ? settled[0].reason.message : "World Cup API error");
        return [] as ApiFixtureItem[];
      })();

  const testFixture = settled[1].status === "fulfilled"
    ? settled[1].value
    : (() => {
        errors.push(settled[1].reason instanceof Error ? settled[1].reason.message : "Test fixture API error");
        return buildFallbackTestFixture();
      })();

  const fixtures = sortFixtures([
    ...worldCupFixtures,
    ...(testFixture ? [testFixture] : []),
  ]);

  const apiConnected = settled.some((result) => result.status === "fulfilled");

  if (apiConnected) {
    return NextResponse.json(
      {
        source: "api-football",
        connection: "live",
        updatedAt: new Date().toISOString(),
        fixtures,
        ...(errors.length ? { error: errors.join(" | ") } : {}),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  if (errors.length > 0) {
    return NextResponse.json(
      buildCalendarPayload("error", errors.join(" | ")),
      {
        status: 500,
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  }

  return NextResponse.json(buildCalendarPayload("calendar"), {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
