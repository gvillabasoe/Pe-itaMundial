import { NextResponse } from "next/server";
import { queryDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const result = await queryDb<{ now: string; database: string }>(
      "select now()::text as now, current_database() as database"
    );

    return NextResponse.json({
      ok: true,
      now: result.rows[0]?.now ?? null,
      database: result.rows[0]?.database ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se ha podido conectar con la base de datos.",
      },
      { status: 500 }
    );
  }
}
