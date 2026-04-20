import path from "path";
import { promises as fs } from "fs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createDefaultAdminResults, sanitizeAdminResults, type AdminResults } from "@/lib/admin-results";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const STORAGE_PATH = path.join(process.cwd(), "data", "admin-results.json");
let memoryCache: AdminResults | null = null;

async function readStoredAdminResults() {
  if (memoryCache) {
    return sanitizeAdminResults(memoryCache);
  }

  try {
    const raw = await fs.readFile(STORAGE_PATH, "utf8");
    const parsed = JSON.parse(raw) as AdminResults;
    const sanitized = sanitizeAdminResults(parsed);
    memoryCache = sanitized;
    return sanitized;
  } catch {
    const fallback = createDefaultAdminResults();
    memoryCache = fallback;
    return fallback;
  }
}

async function writeStoredAdminResults(data: AdminResults) {
  memoryCache = data;

  try {
    await fs.mkdir(path.dirname(STORAGE_PATH), { recursive: true });
    await fs.writeFile(STORAGE_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch {
    return;
  }
}

function responseHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
  };
}

export async function GET() {
  const adminResults = await readStoredAdminResults();
  return NextResponse.json(adminResults, { headers: responseHeaders() });
}

export async function POST(request: Request) {
  const cookieStore = cookies();
  const isAdmin = cookieStore.get(ADMIN_COOKIE_NAME)?.value === "1";

  if (!isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401, headers: responseHeaders() });
  }

  try {
    const payload = await request.json();
    const nextResults = sanitizeAdminResults(payload);
    nextResults.savedAt = new Date().toISOString();

    await writeStoredAdminResults(nextResults);

    return NextResponse.json(nextResults, { headers: responseHeaders() });
  } catch {
    return NextResponse.json({ error: "No se han podido guardar los cambios" }, { status: 400, headers: responseHeaders() });
  }
}
