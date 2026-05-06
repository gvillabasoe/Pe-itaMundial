import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 404) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * GET /api/auth/me?id=u_tester
 *
 * Devuelve el registro del usuario para que el cliente pueda hidratar
 * el contexto de Auth al recargar la página. NO devuelve el password_hash.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();

  if (!id) {
    return jsonError("Falta el id de usuario", 400);
  }

  const pool = getDbPool();
  if (!pool) {
    return jsonError("Servicio no disponible", 503);
  }

  try {
    const result = await pool.query<{
      id: string;
      username: string;
      display_name: string;
      role: "user" | "admin";
    }>(
      `select id, username, display_name, role
       from users
       where id = $1
       limit 1`,
      [id]
    );

    const row = result.rows[0];
    if (!row) {
      return jsonError("Usuario no encontrado", 404);
    }

    return NextResponse.json(
      {
        user: {
          id: row.id,
          username: row.username,
          displayName: row.display_name,
          role: row.role,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[/api/auth/me] db error:", error);
    return jsonError("Error en el servicio", 500);
  }
}
