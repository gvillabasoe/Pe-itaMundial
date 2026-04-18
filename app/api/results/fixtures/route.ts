import { NextResponse } from "next/server";
import { normalizeName } from "@/lib/data";
import { normalizeCity } from "@/lib/config/regions";
import type { MatchStage } from "@/lib/worldcup/schedule";

const API_BASE = "https://v3.football.api-sports.io";
const WORLD_CUP_LEAGUE_ID = 1;

export interface ApiFixtureItem {
  apiId: number | null;
  stage: MatchStage;
  roundLabel: string;
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

export async function GET() {
  const apiKey = process.env.API_SPORTS_KEY;

  if (!apiKey) {
    return NextResponse.json({
      source: "calendar",
      connection: "calendar",
      updatedAt: new Date().toISOString(),
      fixtures: [] as ApiFixtureItem[],
    });
  }

  try {
    const response = await fetch(`${API_BASE}/fixtures?league=${WORLD_CUP_LEAGUE_ID}&season=2026`, {
      headers: { "x-apisports-key": apiKey },
      next: { revalidate: 30 },
    } as any);

    if (!response.ok) {
      return NextResponse.json(
        {
          source: "api-football",
          connection: "error",
          updatedAt: new Date().toISOString(),
          fixtures: [] as ApiFixtureItem[],
          error: `API request failed with ${response.status}`,
        },
        { status: 502 }
      );
    }

    const payload = await response.json();

    const fixtures: ApiFixtureItem[] = (payload.response || [])
      .map((item: any) => {
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
        } as ApiFixtureItem;
      })
      .sort((a: ApiFixtureItem, b: ApiFixtureItem) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());

    return NextResponse.json({
      source: "api-football",
      connection: "live",
      updatedAt: new Date().toISOString(),
      fixtures,
    });
  } catch (error) {
    return NextResponse.json(
      {
        source: "api-football",
        connection: "error",
        updatedAt: new Date().toISOString(),
        fixtures: [] as ApiFixtureItem[],
        error: error instanceof Error ? error.message : "Unknown API error",
      },
      { status: 500 }
    );
  }
}
