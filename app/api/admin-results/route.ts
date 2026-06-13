import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminResultsFromDb, saveAdminResultsToDb } from "@/lib/server/admin-results-db";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-session";
import {
  FINISHED_STATUSES,
  applyApiGroupPositionsToAdminResults,
  applyApiKnockoutsToAdminResults,
  applyApiResultsToAdminResults,
  extractFirstGoalMinute,
} from "@/lib/admin-import-fixtures";
import { getLiveFixturesPayload } from "@/lib/server/live-fixtures";

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

export async function GET(request: Request) {
  try {
    const adminResults = await getAdminResultsFromDb();

    // ?raw=1 → estado guardado tal cual (lo usa el formulario del Admin,
    // que debe mostrar solo lo confirmado a mano).
    const raw = new URL(request.url).searchParams.get("raw") === "1";

    // Switch "Resultados automáticos desde la API" (activo por defecto):
    // los partidos FINALIZADOS según la API se completan al vuelo, sin
    // guardarse, y solo en los huecos — lo confirmado a mano siempre gana.
    // Toda la app (clasificación, resultados, progreso) puntúa con esto.
    if (!raw && adminResults.autoImportApi) {
      try {
        const payload = await getLiveFixturesPayload();
        if (payload.connection === "live") {
          // 1) Marcadores de partidos FINALIZADOS (lo manual siempre gana)
          let { merged } = applyApiResultsToAdminResults(
            adminResults,
            payload.fixtures,
            FINISHED_STATUSES
          );
          // 2) Equipos que alcanzan cada ronda eliminatoria (solo rondas
          //    que el admin tenga completamente vacías)
          merged = applyApiKnockoutsToAdminResults(merged, payload.fixtures).merged;
          // 3) Posiciones finales de grupos completos con desempate FIFA
          //    decidible (solo grupos sin ninguna posición puesta a mano)
          merged = applyApiGroupPositionsToAdminResults(merged).merged;
          // 4) Minuto del primer gol del torneo (premio especial), solo si
          //    el admin no lo ha fijado y el inaugural ya terminó
          if (merged.specialResults.minutoPrimerGol === null) {
            const minute = extractFirstGoalMinute(payload.fixtures);
            if (minute !== null) {
              merged = {
                ...merged,
                configured: true,
                specialResults: { ...merged.specialResults, minutoPrimerGol: minute },
              };
            }
          }
          return NextResponse.json(merged, { headers: responseHeaders() });
        }
      } catch {
        // Si los proveedores fallan, servimos lo guardado sin romper nada.
      }
    }

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
  const isAdmin = cookieStore.get(ADMIN_COOKIE_NAME)?.value === "1";

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
