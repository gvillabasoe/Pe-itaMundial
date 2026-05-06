import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, isValidAdminSessionValue } from "@/lib/admin-session";
import { isPastEditDeadline } from "@/lib/edit-deadline";
import { assertUserTeamMutationAllowed, USER_TEAM_AUTH_ERROR, USER_TEAM_DEADLINE_ERROR } from "@/lib/server/user-team-permissions";
import { deleteUserTeamFromDb } from "@/lib/server/user-teams-db";
import { getUserSessionFromRequest } from "@/lib/user-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseHeaders() {
  return { "Cache-Control": "no-store, max-age=0" };
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

function statusForDeleteError(message: string) {
  if (message === USER_TEAM_AUTH_ERROR) return 403;
  if (message === USER_TEAM_DEADLINE_ERROR) return 403;
  if (message === "Debes indicar la porra a eliminar.") return 400;
  if (message === "La porra no existe.") return 404;
  return 500;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { teamId?: string };
    const teamId = String(body?.teamId || "").trim();
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

    const deleted = await deleteUserTeamFromDb(teamId, isAdmin ? undefined : session!.userId);
    return NextResponse.json({ ok: true, deletedId: deleted.id }, { headers: responseHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al eliminar la porra";
    return NextResponse.json({ error: message }, { status: statusForDeleteError(message), headers: responseHeaders() });
  }
}
