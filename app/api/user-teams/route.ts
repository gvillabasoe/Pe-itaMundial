import path from "path";
import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import { createEmptyUserTeamsStore, sanitizeUserTeam, sanitizeUserTeamsStore, type UserTeamsStore } from "@/lib/user-teams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const STORAGE_PATH = path.join(process.cwd(), "data", "user-teams.json");
let memoryCache: UserTeamsStore | null = null;

function responseHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
  };
}

async function readStoredUserTeams() {
  if (memoryCache) {
    return sanitizeUserTeamsStore(memoryCache);
  }

  try {
    const raw = await fs.readFile(STORAGE_PATH, "utf8");
    const parsed = JSON.parse(raw) as UserTeamsStore;
    const sanitized = sanitizeUserTeamsStore(parsed);
    memoryCache = sanitized;
    return sanitized;
  } catch {
    const fallback = createEmptyUserTeamsStore();
    memoryCache = fallback;
    return fallback;
  }
}

async function writeStoredUserTeams(data: UserTeamsStore) {
  memoryCache = data;
  await fs.mkdir(path.dirname(STORAGE_PATH), { recursive: true });
  await fs.writeFile(STORAGE_PATH, JSON.stringify(data, null, 2), "utf8");
}

export async function GET() {
  const store = await readStoredUserTeams();
  return NextResponse.json(store, { headers: responseHeaders() });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const entry = sanitizeUserTeam(payload?.entry);

    if (!entry) {
      return NextResponse.json({ error: "La porra no es válida." }, { status: 400, headers: responseHeaders() });
    }

    const store = await readStoredUserTeams();
    const currentForUser = store.entries.filter((item) => item.userId === entry.userId);
    const exists = store.entries.some((item) => item.id === entry.id);

    if (!exists && currentForUser.length >= 3) {
      return NextResponse.json({ error: "Cada usuario puede tener un máximo de 3 porras." }, { status: 400, headers: responseHeaders() });
    }

    const savedEntry = {
      ...entry,
      createdAt: entry.createdAt || new Date().toISOString(),
      locked: true,
      source: "user" as const,
    };

    const nextEntries = exists
      ? store.entries.map((item) => (item.id === savedEntry.id ? savedEntry : item))
      : [...store.entries, savedEntry];

    const nextStore: UserTeamsStore = {
      version: store.version,
      savedAt: new Date().toISOString(),
      entries: nextEntries,
    };

    await writeStoredUserTeams(nextStore);

    return NextResponse.json(savedEntry, { headers: responseHeaders() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se ha podido guardar la porra." },
      { status: 500, headers: responseHeaders() }
    );
  }
}
