import { NextResponse } from "next/server";
import { fetchPolymarketSnapshot } from "@/lib/probabilities/polymarket";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await fetchPolymarketSnapshot();
  const status = snapshot.ranking.length > 0 ? 200 : 503;

  return NextResponse.json(snapshot, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
