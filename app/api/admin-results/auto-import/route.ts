import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminResultsFromDb, saveAdminResultsToDb } from "@/lib/server/admin-results-db";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Persiste SOLO el switch "Resultados automáticos desde la API".
// Se guarda al instante sobre el estado ya almacenado, sin arrastrar
// ediciones sin guardar que el admin tenga en el formulario.

export async function POST(request: Request) {
  const cookieStore = cookies();
  const isAdmin = cookieStore.get(ADMIN_COOKIE_NAME)?.value === "1";
  if (!isAdmin) {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  try {
    const payload = await request.json();
    const enabled = Boolean(payload?.enabled);
    const stored = await getAdminResultsFromDb();
    const next = await saveAdminResultsToDb({ ...stored, autoImportApi: enabled });
    return NextResponse.json(next, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se ha podido guardar el ajuste" },
      { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
