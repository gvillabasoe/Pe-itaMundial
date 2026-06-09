import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { queryDb } from "@/lib/db";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdmin(): boolean {
  try {
    return cookies().get(ADMIN_COOKIE_NAME)?.value === "1";
  } catch {
    return false;
  }
}

// POST /api/admin/users/set-active  { id, active }
// active = false -> usuario dado de baja (no podrá iniciar sesión).
// active = true  -> reactivado. Acción reversible.
export async function POST(request: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { id?: string; active?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  }

  const id = String(body?.id || "").trim();
  if (!id) {
    return NextResponse.json({ error: "Falta el id de usuario" }, { status: 400 });
  }
  if (typeof body?.active !== "boolean") {
    return NextResponse.json({ error: "Falta el estado 'active' (true/false)" }, { status: 400 });
  }

  try {
    const result = await queryDb<{ id: string; username: string; active: boolean }>(
      `UPDATE users SET active = $1, updated_at = now() WHERE id = $2 RETURNING id, username, active`,
      [body.active, id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, user: result.rows[0] });
  } catch (error) {
    console.error("[/api/admin/users/set-active]", error);
    return NextResponse.json({ error: "Error al cambiar el estado del usuario" }, { status: 500 });
  }
}
