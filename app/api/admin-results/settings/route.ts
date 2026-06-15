import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminResultsFromDb, saveAdminResultsToDb } from "@/lib/server/admin-results-db";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Persiste ajustes booleanos globales del Admin SIN arrastrar ediciones sin
// guardar del formulario: lee el estado almacenado y solo toca el/los flag(s)
// enviados. Admite:
//   - autoImportApi    (resultados automáticos desde la API)
//   - allowNewPorras   (permitir crear nuevas porras)

const ALLOWED_FLAGS = ["autoImportApi", "allowNewPorras"] as const;
type FlagKey = (typeof ALLOWED_FLAGS)[number];

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
    const updates: Partial<Record<FlagKey, boolean>> = {};
    for (const flag of ALLOWED_FLAGS) {
      if (payload && typeof payload[flag] === "boolean") {
        updates[flag] = payload[flag];
      }
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Ningún ajuste válido en la petición" },
        { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }
    const stored = await getAdminResultsFromDb();
    const next = await saveAdminResultsToDb({ ...stored, ...updates });
    return NextResponse.json(next, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se ha podido guardar el ajuste" },
      { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
