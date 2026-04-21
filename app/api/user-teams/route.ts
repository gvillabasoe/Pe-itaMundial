import { NextResponse } from "next/server";
import { getUserTeamsStoreFromDb, saveUserTeamToDb } from "@/lib/server/user-teams-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function responseHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
  };
}

export async function GET() {
  try {
    const store = await getUserTeamsStoreFromDb();
    return NextResponse.json(store, { headers: responseHeaders() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se ha podido leer la porra guardada." },
      { status: 500, headers: responseHeaders() }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const savedEntry = await saveUserTeamToDb(payload?.entry || {});
    return NextResponse.json(savedEntry, { headers: responseHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se ha podido guardar la porra.";
    const status = message === "La porra no es válida." || message.includes("máximo de 3 porras") ? 400 : 500;
    return NextResponse.json({ error: message }, { status, headers: responseHeaders() });
  }
}
