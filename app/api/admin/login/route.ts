import { NextResponse } from "next/server";
import { isAdminCredentials } from "@/lib/admin-auth";
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_MAX_AGE } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

type ParsedLoginRequest = {
  username: string;
  password: string;
  redirectTo: string;
  mode: "json" | "form";
};

function applySessionCookie(response: NextResponse) {
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
}

function getSafeRedirectTarget(request: Request, value: string) {
  const fallback = "/admin";
  if (!value || !value.startsWith("/")) return fallback;

  try {
    return new URL(value, request.url).pathname || fallback;
  } catch {
    return fallback;
  }
}

function buildErrorRedirect(request: Request, message: string) {
  const url = new URL("/admin/login", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, {
    status: 303,
    headers: NO_STORE_HEADERS,
  });
}

async function parseLoginRequest(request: Request): Promise<ParsedLoginRequest> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    return {
      username: String(body?.username ?? ""),
      password: String(body?.password ?? ""),
      redirectTo: "/admin",
      mode: "json",
    };
  }

  const formData = await request.formData();

  return {
    username: String(formData.get("username") ?? ""),
    password: String(formData.get("password") ?? ""),
    redirectTo: getSafeRedirectTarget(request, String(formData.get("redirectTo") ?? "/admin")),
    mode: "form",
  };
}

export async function POST(request: Request) {
  try {
    const { username, password, redirectTo, mode } = await parseLoginRequest(request);

    if (!isAdminCredentials(username, password)) {
      if (mode === "json") {
        return NextResponse.json(
          { error: "Credenciales incorrectas" },
          { status: 401, headers: NO_STORE_HEADERS }
        );
      }

      return buildErrorRedirect(request, "Credenciales incorrectas");
    }

    if (mode === "json") {
      const response = NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
      return applySessionCookie(response);
    }

    const response = NextResponse.redirect(new URL(redirectTo, request.url), {
      status: 303,
      headers: NO_STORE_HEADERS,
    });

    return applySessionCookie(response);
  } catch {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "No se ha podido iniciar sesión" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    return buildErrorRedirect(request, "No se ha podido iniciar sesión");
  }
}
