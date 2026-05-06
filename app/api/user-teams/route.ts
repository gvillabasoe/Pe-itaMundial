import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, isValidAdminSessionValue } from "@/lib/admin-session";
import { isPastEditDeadline } from "@/lib/edit-deadline";
import { assertUserTeamMutationAllowed, USER_TEAM_AUTH_ERROR, USER_TEAM_DEADLINE_ERROR } from "@/lib/server/user-team-permissions";
import { deleteUserTeamFromDb, getUserTeamsStoreFromDb, saveUserTeamToDb } from "@/lib/server/user-teams-db";
import { getUserSessionFromRequest } from "@/lib/user-session";

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

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) return rawValue.join("=");
  }
  return null;
}

async function isAdminRequest(request: Request) {
  return isValidAdminSessionValue(getCookieValue(request.headers.get("cookie"), ADMIN_COOKIE_NAME));
}

function statusForUserTeamsError(message: string) {
  if (message === USER_TEAM_AUTH_ERROR) return 403;
  if (message === USER_TEAM_DEADLINE_ERROR) return 403;
  if (message === "La porra no es válida." || message.includes("máximo de 3 porras")) return 400;
  if (message === "Debes indicar la porra a eliminar." || message === "La porra no existe.") return 400;
  return 500;
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
    const rawEntry = payload?.entry && typeof payload.entry === "object" ? { ...payload.entry } : {};
    const isAdmin = await isAdminRequest(request);
    const session = isAdmin ? null : getUserSessionFromRequest(request);

    if (!isAdmin && !session) {
      return NextResponse.json({ error: USER_TEAM_AUTH_ERROR }, { status: 401, headers: responseHeaders() });
    }

    const entry = isAdmin
      ? rawEntry
      : {
          ...rawEntry,
          userId: session!.userId,
          username: session!.username,
        };

    if (!isAdmin) {
      assertUserTeamMutationAllowed({
        operation: entry.id ? "update" : "create",
        isAdmin: false,
        actorUserId: session!.userId,
        ownerUserId: typeof rawEntry.userId === "string" ? rawEntry.userId : null,
        isPastDeadline: isPastEditDeadline(),
      });
    }

    const savedEntry = await saveUserTeamToDb(entry, {
      actorUserId: session?.userId,
      isAdmin,
    });
    return NextResponse.json(savedEntry, { headers: responseHeaders() });
  } catch (error) {
    const message = normalizeUserTeamsError(error, "No se ha podido guardar la porra.");
    return NextResponse.json({ error: message }, { status: statusForUserTeamsError(message), headers: responseHeaders() });
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = await request.json();
    const isAdmin = await isAdminRequest(request);
    const session = isAdmin ? null : getUserSessionFromRequest(request);

    if (!isAdmin && !session) {
      return NextResponse.json({ error: USER_TEAM_AUTH_ERROR }, { status: 401, headers: responseHeaders() });
    }

    if (!isAdmin) {
      assertUserTeamMutationAllowed({
        operation: "delete",
        isAdmin: false,
        actorUserId: session!.userId,
        isPastDeadline: isPastEditDeadline(),
      });
    }

    const deleted = await deleteUserTeamFromDb(String(payload?.id || ""), isAdmin ? undefined : session!.userId);
    return NextResponse.json(deleted, { headers: responseHeaders() });
  } catch (error) {
    const message = normalizeUserTeamsError(error, "No se ha podido eliminar la porra.");
    return NextResponse.json({ error: message }, { status: statusForUserTeamsError(message), headers: responseHeaders() });
  }
}
