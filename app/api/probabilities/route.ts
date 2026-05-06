import { NextResponse } from "next/server";
import { fetchPolymarketSnapshot } from "@/lib/probabilities/polymarket";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const marketKey = url.searchParams.get("market");
  const snapshot = await fetchPolymarketSnapshot(marketKey);
  const hasRanking = snapshot.ranking.length > 0 || Boolean(snapshot.groups?.some((group) => group.ranking.length > 0));
  const status = hasRanking ? 200 : 503;

  return NextResponse.json(snapshot, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
