import path from "path";
import { promises as fs } from "fs";
import type { AdminResults } from "@/lib/admin-results";
import { createDefaultAdminResults, sanitizeAdminResults } from "@/lib/admin-results";
import { queryDb } from "@/lib/db";

type AdminResultsRow = {
  id: number;
  data: AdminResults | Partial<AdminResults> | null;
  saved_at: Date | string | null;
  updated_at: Date | string;
};

const FALLBACK_PATH = path.join(process.cwd(), "data", "admin-results.json");

async function readFallbackAdminResults() {
  try {
    const raw = await fs.readFile(FALLBACK_PATH, "utf8");
    return sanitizeAdminResults(JSON.parse(raw) as Partial<AdminResults>);
  } catch {
    return createDefaultAdminResults();
  }
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function getAdminResultsFromDb() {
  const result = await queryDb<AdminResultsRow>(
    `
      select id, data, saved_at, updated_at
      from admin_results
      where id = 1
      limit 1
    `
  );

  if (result.rowCount === 0) {
    return readFallbackAdminResults();
  }

  const row = result.rows[0];
  const payload = row.data && typeof row.data === "object" ? row.data : {};

  return sanitizeAdminResults({
    ...payload,
    savedAt: (payload as Partial<AdminResults>).savedAt || toIsoString(row.saved_at) || null,
  });
}

export async function saveAdminResultsToDb(input: Partial<AdminResults>) {
  const nextResults = sanitizeAdminResults(input);
  nextResults.savedAt = new Date().toISOString();

  await queryDb(
    `
      insert into admin_results (id, data, saved_at, updated_at)
      values (1, $1::jsonb, $2::timestamptz, now())
      on conflict (id) do update
      set
        data = excluded.data,
        saved_at = excluded.saved_at,
        updated_at = now()
    `,
    [JSON.stringify(nextResults), nextResults.savedAt]
  );

  return nextResults;
}
