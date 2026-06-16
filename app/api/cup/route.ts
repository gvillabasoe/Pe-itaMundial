import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-session";
import { getCupConfigFromDb, saveCupConfigToDb } from "@/lib/server/cup-db";
import { drawGroups } from "@/lib/cup/draw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function headers() {
  return { "Cache-Control": "no-store, max-age=0" };
}

export async function GET() {
  try {
    const config = await getCupConfigFromDb();
    return NextResponse.json(config, { headers: headers() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se ha podido leer la Copa." },
      { status: 500, headers: headers() }
    );
  }
}

export async function POST(request: Request) {
  const isAdmin = cookies().get(ADMIN_COOKIE_NAME)?.value === "1";
  if (!isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401, headers: headers() });
  }

  try {
    const body = (await request.json()) as { action?: string; roster?: unknown; seed?: unknown };

    if (body.action === "reset") {
      const config = await saveCupConfigToDb({ locked: false, seed: 0, roster: [], groups: {} });
      return NextResponse.json(config, { headers: headers() });
    }

    if (body.action === "draw") {
      const roster = Array.isArray(body.roster) ? body.roster.filter((x): x is string => typeof x === "string") : [];
      if (roster.length < 2) {
        return NextResponse.json({ error: "No hay porras suficientes para el sorteo." }, { status: 400, headers: headers() });
      }
      const seed = typeof body.seed === "number" && Number.isFinite(body.seed) ? body.seed : Math.floor(Math.random() * 1_000_000_000);
      const groups = drawGroups(roster, seed);
      const config = await saveCupConfigToDb({ locked: true, seed, roster, groups });
      return NextResponse.json(config, { headers: headers() });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400, headers: headers() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se ha podido guardar la Copa." },
      { status: 400, headers: headers() }
    );
  }
}
