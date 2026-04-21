import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminResultsFromDb, saveAdminResultsToDb } from "@/lib/server/admin-results-db";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  const isAdmin = cookieStore.get(ADMIN_COOKIE_NAME)?.value === "1";

  if (!isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401, headers: responseHeaders() });
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
