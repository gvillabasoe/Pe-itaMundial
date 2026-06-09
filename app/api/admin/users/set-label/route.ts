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

// POST /api/admin/users/set-label  { id, label }
// label = "" o null  -> borra la etiqueta.
export async function POST(request: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { id?: string; label?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  }

  const id = String(body?.id || "").trim();
  if (!id) {
    return NextResponse.json({ error: "Falta el id de usuario" }, { status: 400 });
  }

  const raw = (body?.label ?? "").toString().trim();
  if (raw.length > 40) {
    return NextResponse.json({ error: "La etiqueta no puede superar 40 caracteres" }, { status: 400 });
  }
  const label = raw === "" ? null : raw;

  try {
    const result = await queryDb<{ id: string; label: string | null }>(
      `UPDATE users SET label = $1, updated_at = now() WHERE id = $2 RETURNING id, label`,
      [label, id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, user: result.rows[0] });
  } catch (error) {
    console.error("[/api/admin/users/set-label]", error);
    return NextResponse.json({ error: "Error al guardar la etiqueta" }, { status: 500 });
  }
}
