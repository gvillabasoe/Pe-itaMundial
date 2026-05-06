import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { verifyScryptHash } from "@/lib/password";
import { applyUserSessionCookie } from "@/lib/user-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LoginPayload {
  username: string;
  password: string;
}

function jsonError(message: string, status = 401) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  let payload: LoginPayload;

  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    return jsonError("Petición inválida", 400);
  }

  const username = String(payload?.username || "").trim().toLowerCase();
  const password = String(payload?.password || "");

  if (!username || !password) {
    return jsonError("Faltan credenciales", 400);
  }

  // Delay artificial uniforme (~250ms) para mitigar ataques de timing
  // que enumeran usuarios existentes basándose en la diferencia entre
  // un usuario inexistente y uno con contraseña errónea.
  const start = Date.now();

  const pool = getDbPool();
  if (!pool) {
    return jsonError("Servicio no disponible", 503);
  }

  try {
    const result = await pool.query<{
      id: string;
      username: string;
      password_hash: string;
      display_name: string;
      role: "user" | "admin";
    }>(
      `select id, username, password_hash, display_name, role
       from users
       where lower(username) = $1
       limit 1`,
      [username]
    );

    const row = result.rows[0];
    const valid = row?.password_hash
      ? await verifyScryptHash(password, row.password_hash)
      : false;

    // Pad timing a 250ms mínimo
    const elapsed = Date.now() - start;
    if (elapsed < 250) {
      await new Promise((r) => setTimeout(r, 250 - elapsed));
    }

    if (!row || !valid) {
      return jsonError("Usuario o contraseña incorrectos", 401);
    }

    const response = NextResponse.json(
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

    return applyUserSessionCookie(response, {
      userId: row.id,
      username: row.username,
      role: row.role,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[/api/auth/login] db error:", error);
    return jsonError("Error en el servicio de autenticación", 500);
  }
}
