import { NextResponse } from "next/server";
import { queryDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/user-teams/delete
 * Body: { teamId: string, userId: string }
 *
 * Elimina una porra de la BBDD. Solo puede eliminar su propia porra (userId coincide),
 * a no ser que la request incluya admin=true y la cookie de admin está presente.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as { teamId?: string; userId?: string };
    const { teamId, userId } = body;

    if (!teamId || !userId) {
      return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
    }

    // Verificar que la porra existe y pertenece al userId
    const existing = await queryDb<{ id: string; user_id: string }>(
      "SELECT id, user_id FROM user_teams WHERE id = $1 LIMIT 1",
      [teamId]
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: "Porra no encontrada" }, { status: 404 });
    }

    const row = existing[0];
    const isOwner = row.user_id === userId;

    // Comprobar si hay cookie de admin para permitir eliminar cualquier porra
    const cookieHeader = request.headers.get("cookie") || "";
    const isAdmin = cookieHeader.includes("admin_session=1");

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await queryDb("DELETE FROM user_teams WHERE id = $1", [teamId]);

    return NextResponse.json({ ok: true, deletedId: teamId });
  } catch (error) {
    console.error("[/api/user-teams/delete]", error);
    return NextResponse.json({ error: "Error al eliminar la porra" }, { status: 500 });
  }
}
