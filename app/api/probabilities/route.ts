import { NextResponse } from "next/server";
import { fetchPolymarketSnapshot } from "@/lib/probabilities/polymarket";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const marketKey = url.searchParams.get("market");
  const snapshot = await fetchPolymarketSnapshot(marketKey);
  const status = snapshot.ranking.length > 0 ? 200 : 503;

  return NextResponse.json(snapshot, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
