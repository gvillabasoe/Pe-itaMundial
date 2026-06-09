import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes, scryptSync } from "node:crypto";
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

// Mismo formato scrypt que usa /api/admin/users/create y verifica el login.
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const N = 16384, r = 8, p = 1, keyLen = 64;
  const derived = scryptSync(password, salt, keyLen, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

// Genera una contraseña temporal legible (sin caracteres ambiguos).
function generateTempPassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

// POST /api/admin/users/reset-password  { id }  (o { username })
// Como las contraseñas están hasheadas y no se pueden mostrar, esta es la
// alternativa: genera una temporal, la guarda hasheada y la devuelve UNA vez
// para que el admin se la comunique al usuario.
export async function POST(request: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { id?: string; username?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  }

  const id = String(body?.id || "").trim();
  const username = String(body?.username || "").trim().toLowerCase();
  if (!id && !username) {
    return NextResponse.json({ error: "Falta el usuario a resetear" }, { status: 400 });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = hashPassword(tempPassword);

  try {
    const result = await queryDb<{ id: string; username: string }>(
      id
        ? `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2 RETURNING id, username`
        : `UPDATE users SET password_hash = $1, updated_at = now() WHERE lower(username) = $2 RETURNING id, username`,
      [passwordHash, id || username]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      user: result.rows[0],
      // Se muestra solo en esta respuesta. No se almacena en claro.
      tempPassword,
    });
  } catch (error) {
    console.error("[/api/admin/users/reset-password]", error);
    return NextResponse.json({ error: "Error al resetear la contraseña" }, { status: 500 });
  }
}
