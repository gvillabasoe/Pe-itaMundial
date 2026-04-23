import { NextResponse } from "next/server";
import { deleteUserTeamFromDb, getUserTeamsStoreFromDb, saveUserTeamToDb } from "@/lib/server/user-teams-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function responseHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
  };
}

function normalizeUserTeamsError(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage;

  if (/column\s+"entry"\s+of relation\s+"user_teams"\s+does not exist/i.test(message)) {
    return "La tabla user_teams de Neon estaba desactualizada. La app ha intentado repararla automáticamente. Vuelve a guardar la porra.";
  }

  const requiredColumnMatch = message.match(/null value in column "([^"]+)" of relation "user_teams" violates not-null constraint/i);
  if (requiredColumnMatch) {
    return `La tabla user_teams de Neon conserva una columna legacy obligatoria (${requiredColumnMatch[1]}). La app ha intentado repararla automáticamente. Vuelve a guardar la porra.`;
  }

  return message;
}

export async function GET() {
  try {
    const store = await getUserTeamsStoreFromDb();
    return NextResponse.json(store, { headers: responseHeaders() });
  } catch (error) {
    return NextResponse.json(
      { error: normalizeUserTeamsError(error, "No se ha podido leer la porra guardada.") },
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
    const message = normalizeUserTeamsError(error, "No se ha podido guardar la porra.");
    const status = message === "La porra no es válida." || message.includes("máximo de 3 porras") ? 400 : 500;
    return NextResponse.json({ error: message }, { status, headers: responseHeaders() });
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = await request.json();
    const deleted = await deleteUserTeamFromDb(String(payload?.id || ""), typeof payload?.userId === "string" ? payload.userId : undefined);
    return NextResponse.json(deleted, { headers: responseHeaders() });
  } catch (error) {
    const message = normalizeUserTeamsError(error, "No se ha podido eliminar la porra.");
    const status = message === "Debes indicar la porra a eliminar." || message === "La porra no existe." ? 400 : 500;
    return NextResponse.json({ error: message }, { status, headers: responseHeaders() });
  }
}
