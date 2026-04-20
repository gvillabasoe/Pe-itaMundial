import { NextResponse } from "next/server";
import { isAdminCredentials } from "@/lib/admin-auth";
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_MAX_AGE } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username ?? "");
    const password = String(body?.password ?? "");

    if (!isAdminCredentials(username, password)) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } });
    }

    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store, max-age=0" } });
    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: "1",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "No se ha podido iniciar sesión" }, { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
