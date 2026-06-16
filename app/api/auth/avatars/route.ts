import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/auth/avatars
// Devuelve el mapa { userId: avatarUrl } de todos los usuarios con foto, para
// que la clasificación y demás vistas muestren la foto de cada participante.
// Si la columna aún no existe (BBDD antigua), devuelve un mapa vacío.

export async function GET() {
  const pool = getDbPool();
  if (!pool) {
    return NextResponse.json({ avatars: {} }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const result = await pool.query<{ id: string; avatar_url: string | null }>(
      "select id, avatar_url from users where avatar_url is not null"
    );
    const avatars: Record<string, string> = {};
    for (const row of result.rows) {
      if (row.avatar_url) avatars[row.id] = row.avatar_url;
    }
    return NextResponse.json({ avatars }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Columna inexistente u otro error: degradar a vacío sin romper la app.
    return NextResponse.json({ avatars: {} }, { headers: { "Cache-Control": "no-store" } });
  }
}
