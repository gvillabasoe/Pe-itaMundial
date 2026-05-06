import { NextResponse } from "next/server";
import { clearUserSessionCookie } from "@/lib/user-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  return clearUserSessionCookie(response);
}
