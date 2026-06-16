import { NextResponse } from "next/server";
import { queryDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ════════════════════════════════════════════════════════════
// Foto de perfil del usuario (avatar).
//
//   POST /api/auth/avatar   { userId, avatarUrl }   → guarda
//   POST /api/auth/avatar   { userId, avatarUrl: null } → la quita
//
// La imagen llega ya redimensionada y comprimida desde el navegador como
// data URL JPEG (data:image/jpeg;base64,...). Aquí solo validamos formato
// y tamaño y la guardamos en users.avatar_url. El usuario solo puede
// cambiar SU PROPIO avatar (se identifica por su userId de sesión).
// ════════════════════════════════════════════════════════════

// Límite defensivo: un avatar de 128px en JPEG ronda 5-15 KB. Aceptamos hasta
// ~200 KB de data URL por si el navegador no comprimiera tanto, pero cortamos
// ahí para no inflar la base de datos.
const MAX_DATA_URL_LENGTH = 200_000;
const DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export async function POST(request: Request) {
  let body: { userId?: string; avatarUrl?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  }

  const userId = String(body?.userId || "").trim();
  if (!userId) {
    return NextResponse.json({ error: "Falta el usuario" }, { status: 400 });
  }

  const avatarUrl = body?.avatarUrl;

  // Quitar avatar
  if (avatarUrl === null || avatarUrl === "") {
    try {
      await ensureAvatarColumn();
      await queryDb("update users set avatar_url = null where id = $1", [userId]);
      return NextResponse.json({ ok: true, avatarUrl: null }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "No se ha podido quitar la foto" },
        { status: 500 }
      );
    }
  }

  // Validación de la imagen
  if (typeof avatarUrl !== "string" || !DATA_URL_RE.test(avatarUrl)) {
    return NextResponse.json(
      { error: "Formato no válido. Sube una imagen JPG o PNG." },
      { status: 400 }
    );
  }
  if (avatarUrl.length > MAX_DATA_URL_LENGTH) {
    return NextResponse.json(
      { error: "La imagen es demasiado grande. Prueba con otra más pequeña." },
      { status: 413 }
    );
  }

  try {
    await ensureAvatarColumn();
    const result = await queryDb<{ id: string }>(
      "update users set avatar_url = $2 where id = $1 returning id",
      [userId, avatarUrl]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, avatarUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se ha podido guardar la foto" },
      { status: 500 }
    );
  }
}

let avatarColumnEnsured = false;
async function ensureAvatarColumn() {
  if (avatarColumnEnsured) return;
  await queryDb("alter table users add column if not exists avatar_url text");
  avatarColumnEnsured = true;
}
