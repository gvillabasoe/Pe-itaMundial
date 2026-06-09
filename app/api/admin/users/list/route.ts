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

// GET /api/admin/users/list
// Devuelve todos los usuarios. NUNCA devuelve el password_hash:
// las contraseñas están hasheadas con scrypt y no se pueden mostrar.
export async function GET() {
  if (!isAdmin()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const result = await queryDb<{
      id: string;
      username: string;
      display_name: string;
      role: "user" | "admin";
      label: string | null;
      active: boolean;
      created_at: string;
    }>(
      `SELECT id, username, display_name, role, label, active, created_at
         FROM users
        ORDER BY created_at ASC`
    );

    return NextResponse.json(
      {
        users: result.rows.map((r) => ({
          id: r.id,
          username: r.username,
          displayName: r.display_name,
          role: r.role,
          label: r.label,
          active: r.active,
          createdAt: r.created_at,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[/api/admin/users/list]", error);
    return NextResponse.json({ error: "Error al listar usuarios" }, { status: 500 });
  }
}
