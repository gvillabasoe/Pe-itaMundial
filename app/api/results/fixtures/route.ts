import { NextResponse } from "next/server";
import { getLiveFixturesPayload, type ResultsApiPayload } from "@/lib/server/live-fixtures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Wrapper HTTP fino: toda la lógica de proveedores (API-Football,
// football-data.org, ESPN) vive en lib/server/live-fixtures.ts para
// poder reutilizarla desde /api/admin-results. Comportamiento público
// idéntico al anterior.

function jsonResponse(payload: ResultsApiPayload, status = 200) {
  const cacheControl =
    payload.connection === "live"
      ? "public, s-maxage=25, stale-while-revalidate=60"
      : "no-store, max-age=0";
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": cacheControl },
  });
}

export async function GET() {
  const payload = await getLiveFixturesPayload();
  return jsonResponse(payload);
}
