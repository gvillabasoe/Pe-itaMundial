import { NextResponse } from "next/server";
import { randomBytes, scryptSync } from "node:crypto";
import { queryDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdmin(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  return cookie.includes("admin_session=1");
}

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const N = 16384, r = 8, p = 1, keyLen = 64;
  const derived = scryptSync(password, salt, keyLen, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function POST(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { username?: string; password?: string; displayName?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  }

  const username = String(body?.username || "").trim().toLowerCase();
  const password = String(body?.password || "").trim();
  const displayName = String(body?.displayName || body?.username || "").trim();
  const role = body?.role === "admin" ? "admin" : "user";

  if (!username || !password) {
    return NextResponse.json({ error: "Usuario y contraseña son obligatorios" }, { status: 400 });
  }
  if (username.length < 2 || username.length > 40) {
    return NextResponse.json({ error: "El nombre de usuario debe tener entre 2 y 40 caracteres" }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 4 caracteres" }, { status: 400 });
  }
  if (!/^[a-z0-9_.-]+$/.test(username)) {
    return NextResponse.json({ error: "El usuario solo puede contener letras, números, _, . y -" }, { status: 400 });
  }

  try {
    const existing = await queryDb<{ id: string }>(
      "SELECT id FROM users WHERE lower(username) = $1 LIMIT 1",
      [username]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: "Ese nombre de usuario ya existe" }, { status: 409 });
    }

    const passwordHash = hashPassword(password);
    const userId = `u_${username}_${Date.now()}`;

    await queryDb(
      `INSERT INTO users (id, username, password_hash, display_name, role)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, username, passwordHash, displayName || username, role]
    );

    return NextResponse.json({
      ok: true,
      user: { id: userId, username, displayName: displayName || username, role },
    });
  } catch (error) {
    console.error("[/api/admin/users/create]", error);
    return NextResponse.json({ error: "Error al crear el usuario" }, { status: 500 });
  }
}
