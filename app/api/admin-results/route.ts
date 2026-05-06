import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminResultsFromDb, saveAdminResultsToDb } from "@/lib/server/admin-results-db";
import { ADMIN_COOKIE_NAME, isValidAdminSessionValue } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Límite razonable para el payload de admin-results: 256 KB.
// El payload normal pesa ~30 KB; cualquier cosa por encima es sospechosa.
const MAX_PAYLOAD_BYTES = 256 * 1024;

function responseHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
  };
}

export async function GET() {
  try {
    const adminResults = await getAdminResultsFromDb();
    return NextResponse.json(adminResults, { headers: responseHeaders() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se han podido leer los resultados." },
      { status: 500, headers: responseHeaders() }
    );
  }
}

export async function POST(request: Request) {
  const cookieStore = cookies();
  const isAdmin = await isValidAdminSessionValue(cookieStore.get(ADMIN_COOKIE_NAME)?.value);

  if (!isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401, headers: responseHeaders() });
  }

  // Validación de tamaño del payload (defensa en profundidad)
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const size = Number(contentLength);
    if (Number.isFinite(size) && size > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { error: `Payload demasiado grande (${size} bytes, máximo ${MAX_PAYLOAD_BYTES})` },
        { status: 413, headers: responseHeaders() }
      );
    }
  }

  try {
    const payload = await request.json();
    const nextResults = await saveAdminResultsToDb(payload);
    return NextResponse.json(nextResults, { headers: responseHeaders() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se han podido guardar los cambios" },
      { status: 400, headers: responseHeaders() }
    );
  }
}
