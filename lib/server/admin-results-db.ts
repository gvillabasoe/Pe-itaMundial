import path from "path";
import { promises as fs } from "fs";
import type { PoolClient } from "pg";
import type { AdminResults } from "@/lib/admin-results";
import { createDefaultAdminResults, hasConfiguredAdminResults, sanitizeAdminResults } from "@/lib/admin-results";
import { queryDb, shouldRunRuntimeSchemaMigrations, withTransaction } from "@/lib/db";

type AdminResultsColumnRow = {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
};

type AdminResultsCandidate = {
  results: AdminResults;
  savedAt: string | null;
  updatedAt: string | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __penitaAdminResultsSchemaReady__: Promise<void> | undefined;
}

const FALLBACK_PATH = path.join(process.cwd(), "data", "admin-results.json");
const TARGET_ADMIN_RESULTS_COLUMNS = new Set(["id", "data", "saved_at", "updated_at"]);
const LEGACY_WHOLE_PAYLOAD_COLUMNS = ["data", "payload", "result", "results", "admin_data", "json", "content", "body", "value"] as const;
const LEGACY_STRUCTURED_COLUMN_ALIASES = {
  version: ["version"] as const,
  configured: ["configured"] as const,
  savedAt: ["savedAt", "saved_at"] as const,
  matchResults: ["matchResults", "match_results"] as const,
  groupPositions: ["groupPositions", "group_positions"] as const,
  knockoutRounds: ["knockoutRounds", "knockout_rounds"] as const,
  podium: ["podium"] as const,
  specialResults: ["specialResults", "special_results"] as const,
};

async function readFallbackAdminResults() {
  try {
    const raw = await fs.readFile(FALLBACK_PATH, "utf8");
    return sanitizeAdminResults(JSON.parse(raw) as Partial<AdminResults>);
  } catch {
    return createDefaultAdminResults();
  }
}

function escapeIdentifier(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function toIsoString(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function safeParseObject(value: unknown) {
  if (!value) return null;

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function coerceBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase();
  if (["true", "t", "1", "yes", "y", "si", "sí"].includes(normalized)) return true;
  if (["false", "f", "0", "no", "n"].includes(normalized)) return false;
  return undefined;
}

function coerceNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function findFirstValue(row: Record<string, unknown>, names: readonly string[]) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name)) {
      return row[name];
    }
  }
  return undefined;
}

function readObjectFromRow(row: Record<string, unknown>, names: readonly string[]) {
  return safeParseObject(findFirstValue(row, names));
}

function buildStructuredPayload(row: Record<string, unknown>) {
  const next: Partial<AdminResults> = {};
  let hasAny = false;

  const version = coerceNumber(findFirstValue(row, LEGACY_STRUCTURED_COLUMN_ALIASES.version));
  if (typeof version === "number") {
    next.version = Math.trunc(version);
    hasAny = true;
  }

  const configured = coerceBoolean(findFirstValue(row, LEGACY_STRUCTURED_COLUMN_ALIASES.configured));
  if (typeof configured === "boolean") {
    next.configured = configured;
    hasAny = true;
  }

  const savedAt = toIsoString(findFirstValue(row, LEGACY_STRUCTURED_COLUMN_ALIASES.savedAt));
  if (savedAt) {
    next.savedAt = savedAt;
    hasAny = true;
  }

  const matchResults = readObjectFromRow(row, LEGACY_STRUCTURED_COLUMN_ALIASES.matchResults);
  if (matchResults) {
    next.matchResults = matchResults as AdminResults["matchResults"];
    hasAny = true;
  }

  const groupPositions = readObjectFromRow(row, LEGACY_STRUCTURED_COLUMN_ALIASES.groupPositions);
  if (groupPositions) {
    next.groupPositions = groupPositions as AdminResults["groupPositions"];
    hasAny = true;
  }

  const knockoutRounds = readObjectFromRow(row, LEGACY_STRUCTURED_COLUMN_ALIASES.knockoutRounds);
  if (knockoutRounds) {
    next.knockoutRounds = knockoutRounds as AdminResults["knockoutRounds"];
    hasAny = true;
  }

  const podium = readObjectFromRow(row, LEGACY_STRUCTURED_COLUMN_ALIASES.podium);
  if (podium) {
    next.podium = podium as unknown as AdminResults["podium"];
    hasAny = true;
  }

  const specialResults = readObjectFromRow(row, LEGACY_STRUCTURED_COLUMN_ALIASES.specialResults);
  if (specialResults) {
    next.specialResults = specialResults as unknown as AdminResults["specialResults"];
    hasAny = true;
  }

  return hasAny ? next : null;
}

function extractPayloadFromRow(row: Record<string, unknown>) {
  for (const column of LEGACY_WHOLE_PAYLOAD_COLUMNS) {
    const payload = safeParseObject(row[column]);
    if (payload) {
      return payload;
    }
  }

  return buildStructuredPayload(row);
}

function getConfiguredMatchCount(results: AdminResults) {
  return Object.values(results.matchResults).filter(
    (value) => typeof value.home === "number" && typeof value.away === "number"
  ).length;
}

function getConfiguredGroupCount(results: AdminResults) {
  return Object.values(results.groupPositions).filter((value) => value > 0).length;
}

function getConfiguredKnockoutCount(results: AdminResults) {
  return Object.values(results.knockoutRounds).reduce((total, round) => total + round.filter(Boolean).length, 0);
}

function getConfiguredPodiumCount(results: AdminResults) {
  return [results.podium.campeon, results.podium.subcampeon, results.podium.tercero].filter(Boolean).length;
}

function getConfiguredSpecialCount(results: AdminResults) {
  return Object.entries(results.specialResults).filter(([key, value]) => key === "minutoPrimerGol" ? value != null : Boolean(value)).length;
}

function getCandidateScore(candidate: AdminResultsCandidate) {
  const results = candidate.results;
  return (
    (hasConfiguredAdminResults(results) ? 100_000 : 0) +
    getConfiguredMatchCount(results) * 1_000 +
    getConfiguredGroupCount(results) * 25 +
    getConfiguredKnockoutCount(results) * 25 +
    getConfiguredPodiumCount(results) * 25 +
    getConfiguredSpecialCount(results) * 10
  );
}

function compareCandidates(left: AdminResultsCandidate, right: AdminResultsCandidate) {
  const scoreDiff = getCandidateScore(right) - getCandidateScore(left);
  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  const leftTime = Date.parse(left.updatedAt || left.savedAt || "") || 0;
  const rightTime = Date.parse(right.updatedAt || right.savedAt || "") || 0;
  return rightTime - leftTime;
}

function pickBestCandidate(candidates: AdminResultsCandidate[]) {
  if (!candidates.length) {
    return null;
  }

  return [...candidates].sort(compareCandidates)[0] ?? null;
}

function normalizeCandidateFromRow(row: Record<string, unknown>) {
  const payload = extractPayloadFromRow(row);
  const savedAt = toIsoString(row.saved_at) || toIsoString(row.savedAt) || null;
  const updatedAt = toIsoString(row.updated_at) || toIsoString(row.updatedAt) || savedAt;

  if (!payload && !savedAt && !updatedAt) {
    return null;
  }

  const results = sanitizeAdminResults(payload as Partial<AdminResults> | null | undefined);
  results.savedAt = results.savedAt || savedAt || null;

  return {
    results,
    savedAt: results.savedAt || savedAt || null,
    updatedAt,
  } satisfies AdminResultsCandidate;
}

function isJsonColumn(column: AdminResultsColumnRow | undefined) {
  if (!column) return false;
  return column.data_type === "json" || column.data_type === "jsonb" || column.udt_name === "json" || column.udt_name === "jsonb";
}

function isTextColumn(column: AdminResultsColumnRow | undefined) {
  if (!column) return false;
  return (
    column.data_type === "text" ||
    column.data_type === "character varying" ||
    column.data_type === "character" ||
    column.udt_name === "text" ||
    column.udt_name === "varchar" ||
    column.udt_name === "bpchar"
  );
}

function isTimestampColumn(column: AdminResultsColumnRow | undefined) {
  if (!column) return false;
  return (
    column.data_type === "timestamp with time zone" ||
    column.data_type === "timestamp without time zone" ||
    column.data_type === "timestamp" ||
    column.udt_name === "timestamptz" ||
    column.udt_name === "timestamp"
  );
}

function isIntegerColumn(column: AdminResultsColumnRow | undefined) {
  if (!column) return false;
  return (
    column.data_type === "smallint" ||
    column.data_type === "integer" ||
    column.data_type === "bigint" ||
    column.udt_name === "int2" ||
    column.udt_name === "int4" ||
    column.udt_name === "int8"
  );
}

function isUuidColumn(column: AdminResultsColumnRow | undefined) {
  if (!column) return false;
  return column.data_type === "uuid" || column.udt_name === "uuid";
}

function getJsonSqlType(column: AdminResultsColumnRow | undefined) {
  return column?.data_type === "json" || column?.udt_name === "json" ? "json" : "jsonb";
}

function getEmptyJsonLiteral(column: AdminResultsColumnRow | undefined) {
  if (isJsonColumn(column)) {
    return getJsonSqlType(column) === "json" ? "'{}'::json" : "'{}'::jsonb";
  }
  return "'{}'";
}

function getIsoNowSql() {
  return "to_char(now() at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')";
}

function getDataInsertSql(column: AdminResultsColumnRow | undefined, placeholder: string) {
  if (isJsonColumn(column)) {
    return `${placeholder}::${getJsonSqlType(column)}`;
  }
  return placeholder;
}

function getTimestampInsertSql(column: AdminResultsColumnRow | undefined, placeholder: string) {
  if (isTimestampColumn(column)) {
    return `${placeholder}::timestamptz`;
  }
  return placeholder;
}

function getIdInsertSql(column: AdminResultsColumnRow | undefined) {
  if (!column || isIntegerColumn(column)) {
    return "1";
  }

  if (isTextColumn(column)) {
    return "'1'";
  }

  if (isUuidColumn(column)) {
    return "'00000000-0000-0000-0000-000000000001'::uuid";
  }

  if (column.column_default) {
    return "default";
  }

  return "1";
}

async function listAdminResultsColumns() {
  const result = await queryDb<AdminResultsColumnRow>(
    `
      select column_name, data_type, udt_name, is_nullable, column_default
      from information_schema.columns
      where table_schema = current_schema()
        and table_name = 'admin_results'
    `
  );

  return result.rows;
}

async function listAdminResultsColumnsWithClient(client: PoolClient) {
  const result = await client.query<AdminResultsColumnRow>(
    `
      select column_name, data_type, udt_name, is_nullable, column_default
      from information_schema.columns
      where table_schema = current_schema()
        and table_name = 'admin_results'
    `
  );

  return result.rows;
}

async function relaxUnexpectedRequiredColumns(columns: AdminResultsColumnRow[]) {
  for (const column of columns) {
    if (TARGET_ADMIN_RESULTS_COLUMNS.has(column.column_name)) {
      continue;
    }

    if (column.is_nullable === "NO" && !column.column_default) {
      try {
        await queryDb(`alter table admin_results alter column ${escapeIdentifier(column.column_name)} drop not null`);
      } catch {
        // Ignore legacy constraints that cannot be relaxed automatically.
      }
    }
  }
}

async function insertCanonicalAdminResultsRow(
  client: PoolClient,
  columns: AdminResultsColumnRow[],
  results: AdminResults,
  updatedAt?: string | null
) {
  const byName = new Map(columns.map((column) => [column.column_name, column] as const));
  const dataColumn = byName.get("data");
  const savedAtColumn = byName.get("saved_at");
  const updatedAtColumn = byName.get("updated_at");
  const idColumn = byName.get("id");

  const params: Array<string | null> = [JSON.stringify(results), results.savedAt || null, updatedAt || results.savedAt || new Date().toISOString()];
  const idSql = getIdInsertSql(idColumn);
  const dataSql = getDataInsertSql(dataColumn, "$1");
  const savedAtSql = getTimestampInsertSql(savedAtColumn, "$2");
  const updatedAtSql = getTimestampInsertSql(updatedAtColumn, "$3");

  await client.query(
    `
      insert into admin_results (id, data, saved_at, updated_at)
      values (${idSql}, ${dataSql}, ${savedAtSql}, ${updatedAtSql})
    `,
    params
  );
}

async function normalizeExistingAdminResultsRows(columns: AdminResultsColumnRow[]) {
  const result = await queryDb<Record<string, unknown>>("select * from admin_results");

  if (result.rowCount === 0) {
    return;
  }

  const normalizedCandidates = result.rows
    .map((row: Record<string, unknown>) => normalizeCandidateFromRow(row))
    .filter((candidate: AdminResultsCandidate | null): candidate is AdminResultsCandidate => Boolean(candidate));

  const fallback = await readFallbackAdminResults();
  const fallbackCandidate: AdminResultsCandidate = {
    results: fallback,
    savedAt: fallback.savedAt,
    updatedAt: fallback.savedAt,
  };

  const bestCandidate = pickBestCandidate([...normalizedCandidates, fallbackCandidate]) || fallbackCandidate;
  const normalizedResults = sanitizeAdminResults(bestCandidate.results);
  normalizedResults.savedAt = normalizedResults.savedAt || bestCandidate.savedAt || null;

  await withTransaction(async (client) => {
    await client.query("delete from admin_results");
    const freshColumns = await listAdminResultsColumnsWithClient(client);
    await insertCanonicalAdminResultsRow(client, freshColumns, normalizedResults, bestCandidate.updatedAt);
  });
}

async function normalizeCanonicalColumns(columns: AdminResultsColumnRow[]) {
  const dataColumn = columns.find((column) => column.column_name === "data");
  const updatedAtColumn = columns.find((column) => column.column_name === "updated_at");

  if (dataColumn) {
    const quotedName = escapeIdentifier(dataColumn.column_name);
    if (isJsonColumn(dataColumn)) {
      const emptyLiteral = getEmptyJsonLiteral(dataColumn);
      await queryDb(`update admin_results set ${quotedName} = coalesce(${quotedName}, ${emptyLiteral}) where ${quotedName} is null`);
      await queryDb(`alter table admin_results alter column ${quotedName} set default ${emptyLiteral}`);
    } else if (isTextColumn(dataColumn)) {
      await queryDb(`update admin_results set ${quotedName} = coalesce(nullif(btrim(${quotedName}), ''), '{}') where ${quotedName} is null or btrim(${quotedName}) = ''`);
      await queryDb(`alter table admin_results alter column ${quotedName} set default '{}'`);
    }

    try {
      await queryDb(`alter table admin_results alter column ${quotedName} set not null`);
    } catch {
      // Ignore if an old custom schema prevents tightening this constraint.
    }
  }

  if (updatedAtColumn) {
    const quotedName = escapeIdentifier(updatedAtColumn.column_name);
    if (isTimestampColumn(updatedAtColumn)) {
      await queryDb(`update admin_results set ${quotedName} = now() where ${quotedName} is null`);
      await queryDb(`alter table admin_results alter column ${quotedName} set default now()`);
    } else if (isTextColumn(updatedAtColumn)) {
      const nowSql = getIsoNowSql();
      await queryDb(`update admin_results set ${quotedName} = ${nowSql} where ${quotedName} is null or btrim(${quotedName}) = ''`);
      await queryDb(`alter table admin_results alter column ${quotedName} set default ${nowSql}`);
    }

    try {
      await queryDb(`alter table admin_results alter column ${quotedName} set not null`);
    } catch {
      // Ignore if an old custom schema prevents tightening this constraint.
    }
  }
}

async function ensureAdminResultsTableSchemaImpl() {
  if (!shouldRunRuntimeSchemaMigrations()) return;
  await queryDb(
    `
      create table if not exists admin_results (
        id integer primary key default 1 check (id = 1),
        data jsonb not null,
        saved_at timestamptz null,
        updated_at timestamptz not null default now()
      )
    `
  );

  let columns = await listAdminResultsColumns();
  const columnNames = new Set(columns.map((column: AdminResultsColumnRow) => column.column_name));

  if (!columnNames.has("id")) {
    await queryDb("alter table admin_results add column if not exists id integer");
  }
  if (!columnNames.has("data")) {
    await queryDb("alter table admin_results add column if not exists data jsonb");
  }
  if (!columnNames.has("saved_at")) {
    await queryDb("alter table admin_results add column if not exists saved_at timestamptz");
  }
  if (!columnNames.has("updated_at")) {
    await queryDb("alter table admin_results add column if not exists updated_at timestamptz");
  }

  columns = await listAdminResultsColumns();
  await relaxUnexpectedRequiredColumns(columns);

  columns = await listAdminResultsColumns();
  await normalizeExistingAdminResultsRows(columns);

  columns = await listAdminResultsColumns();
  await normalizeCanonicalColumns(columns);
}

async function ensureAdminResultsTableSchema() {
  if (!globalThis.__penitaAdminResultsSchemaReady__) {
    globalThis.__penitaAdminResultsSchemaReady__ = ensureAdminResultsTableSchemaImpl().catch((error) => {
      globalThis.__penitaAdminResultsSchemaReady__ = undefined;
      throw error;
    });
  }

  await globalThis.__penitaAdminResultsSchemaReady__;
}

export async function getAdminResultsFromDb() {
  await ensureAdminResultsTableSchema();

  const result = await queryDb<Record<string, unknown>>("select * from admin_results");
  if (result.rowCount === 0) {
    return readFallbackAdminResults();
  }

  const candidates = result.rows
    .map((row: Record<string, unknown>) => normalizeCandidateFromRow(row))
    .filter((candidate: AdminResultsCandidate | null): candidate is AdminResultsCandidate => Boolean(candidate));

  const bestCandidate = pickBestCandidate(candidates);
  if (!bestCandidate) {
    return readFallbackAdminResults();
  }

  const nextResults = sanitizeAdminResults(bestCandidate.results);
  nextResults.savedAt = nextResults.savedAt || bestCandidate.savedAt || null;
  return nextResults;
}

export async function saveAdminResultsToDb(input: Partial<AdminResults>) {
  await ensureAdminResultsTableSchema();

  const nextResults = sanitizeAdminResults(input);
  nextResults.savedAt = new Date().toISOString();

  await withTransaction(async (client) => {
    const columns = await listAdminResultsColumnsWithClient(client);
    await client.query("delete from admin_results");
    await insertCanonicalAdminResultsRow(client, columns, nextResults, nextResults.savedAt);
  });

  return nextResults;
}
