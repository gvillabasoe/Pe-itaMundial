import path from "path";
import { promises as fs } from "fs";
import type { PoolClient } from "pg";
import type { Team } from "@/lib/data";
import {
  USER_TEAMS_VERSION,
  createEmptyUserTeamsStore,
  sanitizeUserTeam,
  sanitizeUserTeamsStore,
  type UserTeamsStore,
} from "@/lib/user-teams";
import { queryDb, withTransaction } from "@/lib/db";

type UserTeamRow = {
  id: string;
  user_id: string;
  entry: Team | Partial<Team> | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

type UserTeamColumnRow = {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __penitaUserTeamsSchemaReady__: Promise<void> | undefined;
}

const FALLBACK_PATH = path.join(process.cwd(), "data", "user-teams.json");
const TARGET_USER_TEAM_COLUMNS = new Set([
  "id",
  "user_id",
  "username",
  "team_name",
  "entry",
  "locked",
  "source",
  "created_at",
  "updated_at",
]);
const LEGACY_JSON_COLUMNS = ["prediction", "data", "payload", "team_data", "team", "porra", "content", "json"] as const;
const LEGACY_COMPAT_COLUMNS = new Set(["prediction"]);

async function readFallbackUserTeamsStore() {
  try {
    const raw = await fs.readFile(FALLBACK_PATH, "utf8");
    return sanitizeUserTeamsStore(JSON.parse(raw) as Partial<UserTeamsStore>);
  } catch {
    return createEmptyUserTeamsStore();
  }
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeRow(row: UserTeamRow) {
  const entry = row.entry && typeof row.entry === "object" ? row.entry : {};
  return {
    ...entry,
    id: row.id,
    userId: row.user_id,
    createdAt: (entry as Partial<Team>).createdAt || toIsoString(row.created_at) || undefined,
    locked: true,
    source: "user" as const,
  } satisfies Partial<Team>;
}

function buildStore(rows: UserTeamRow[]): UserTeamsStore {
  const entries = rows
    .map((row) => sanitizeUserTeam(normalizeRow(row)))
    .filter((entry): entry is Team => Boolean(entry))
    .sort((left, right) => {
      const leftDate = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightDate = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      return rightDate - leftDate;
    });

  const savedAt = rows
    .map((row) => toIsoString(row.updated_at))
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;

  return sanitizeUserTeamsStore({
    version: USER_TEAMS_VERSION,
    savedAt,
    entries,
  });
}

function escapeIdentifier(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function isJsonColumn(column: UserTeamColumnRow | undefined) {
  if (!column) return false;
  return column.data_type === "json" || column.data_type === "jsonb" || column.udt_name === "json" || column.udt_name === "jsonb";
}

function isTextColumn(column: UserTeamColumnRow | undefined) {
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

function getJsonSqlType(column: UserTeamColumnRow) {
  return column.data_type === "json" || column.udt_name === "json" ? "json" : "jsonb";
}

function getEmptyJsonLiteral(column: UserTeamColumnRow) {
  return getJsonSqlType(column) === "json" ? "'{}'::json" : "'{}'::jsonb";
}

function pickLegacyJsonColumn(columns: UserTeamColumnRow[]) {
  const byName = new Map(columns.map((column: UserTeamColumnRow) => [column.column_name, column]));

  for (const name of LEGACY_JSON_COLUMNS) {
    const column = byName.get(name);
    if (isJsonColumn(column)) {
      return name;
    }
  }

  return columns.find((column: UserTeamColumnRow) => column.column_name !== "entry" && isJsonColumn(column))?.column_name ?? null;
}

async function listUserTeamsColumns() {
  const result = await queryDb<UserTeamColumnRow>(
    `
      select column_name, data_type, udt_name, is_nullable, column_default
      from information_schema.columns
      where table_schema = current_schema()
        and table_name = 'user_teams'
    `
  );

  return result.rows;
}

async function listUserTeamsColumnsWithClient(client: PoolClient) {
  const result = await client.query<UserTeamColumnRow>(
    `
      select column_name, data_type, udt_name, is_nullable, column_default
      from information_schema.columns
      where table_schema = current_schema()
        and table_name = 'user_teams'
    `
  );

  return result.rows;
}

async function ensurePredictionColumnCompatibility(columns: UserTeamColumnRow[]) {
  const predictionColumn = columns.find((column: UserTeamColumnRow) => column.column_name === "prediction");
  if (!predictionColumn) return;

  const quotedName = escapeIdentifier(predictionColumn.column_name);

  if (isJsonColumn(predictionColumn)) {
    const emptyLiteral = getEmptyJsonLiteral(predictionColumn);
    const entryExpression = getJsonSqlType(predictionColumn) === "json" ? "entry::json" : "entry";

    await queryDb(
      `
        update user_teams
        set ${quotedName} = coalesce(${quotedName}, ${entryExpression}, ${emptyLiteral})
        where ${quotedName} is null
      `
    );
    await queryDb(`alter table user_teams alter column ${quotedName} set default ${emptyLiteral}`);
    return;
  }

  if (isTextColumn(predictionColumn)) {
    await queryDb(
      `
        update user_teams
        set ${quotedName} = coalesce(nullif(btrim(${quotedName}), ''), entry::text, '{}')
        where ${quotedName} is null or btrim(${quotedName}) = ''
      `
    );
    await queryDb(`alter table user_teams alter column ${quotedName} set default '{}'`);
    return;
  }

  await queryDb(`alter table user_teams alter column ${quotedName} drop not null`);
}

async function relaxUnexpectedRequiredColumns(columns: UserTeamColumnRow[]) {
  for (const column of columns) {
    if (TARGET_USER_TEAM_COLUMNS.has(column.column_name) || LEGACY_COMPAT_COLUMNS.has(column.column_name)) {
      continue;
    }

    if (column.is_nullable === "NO" && !column.column_default) {
      await queryDb(`alter table user_teams alter column ${escapeIdentifier(column.column_name)} drop not null`);
    }
  }
}

async function ensureUserTeamsTableSchemaImpl() {
  await queryDb(
    `
      create table if not exists user_teams (
        id text primary key,
        user_id text not null,
        username text,
        team_name text,
        entry jsonb,
        locked boolean not null default true,
        source text not null default 'user',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `
  );

  let columns = await listUserTeamsColumns();
  const columnNames = new Set(columns.map((column: UserTeamColumnRow) => column.column_name));

  if (!columnNames.has("user_id")) {
    await queryDb("alter table user_teams add column if not exists user_id text");
  }
  if (!columnNames.has("username")) {
    await queryDb("alter table user_teams add column if not exists username text");
  }
  if (!columnNames.has("team_name")) {
    await queryDb("alter table user_teams add column if not exists team_name text");
  }
  if (!columnNames.has("entry")) {
    await queryDb("alter table user_teams add column if not exists entry jsonb");
  }
  if (!columnNames.has("locked")) {
    await queryDb("alter table user_teams add column if not exists locked boolean");
  }
  if (!columnNames.has("source")) {
    await queryDb("alter table user_teams add column if not exists source text");
  }
  if (!columnNames.has("created_at")) {
    await queryDb("alter table user_teams add column if not exists created_at timestamptz");
  }
  if (!columnNames.has("updated_at")) {
    await queryDb("alter table user_teams add column if not exists updated_at timestamptz");
  }

  columns = await listUserTeamsColumns();
  const legacyJsonColumn = pickLegacyJsonColumn(columns);

  if (legacyJsonColumn) {
    await queryDb(
      `
        update user_teams
        set entry = coalesce(entry, ${escapeIdentifier(legacyJsonColumn)}::jsonb)
        where entry is null
      `
    );
  }

  await queryDb(
    `
      update user_teams
      set entry = jsonb_strip_nulls(
        jsonb_build_object(
          'id', id,
          'userId', user_id,
          'username', nullif(btrim(username), ''),
          'name', nullif(btrim(team_name), ''),
          'createdAt', to_char(coalesce(created_at, now()) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'locked', coalesce(locked, true),
          'source', case when source in ('user', 'demo') then source else 'user' end
        )
      )
      where entry is null or jsonb_typeof(entry) <> 'object'
    `
  );

  await queryDb(
    `
      update user_teams
      set entry = '{}'::jsonb
      where entry is null or jsonb_typeof(entry) <> 'object'
    `
  );

  await queryDb(
    `
      update user_teams
      set user_id = coalesce(nullif(btrim(user_id), ''), nullif(entry->>'userId', ''), id)
      where user_id is null or btrim(user_id) = ''
    `
  );

  await queryDb(
    `
      update user_teams
      set username = coalesce(nullif(btrim(username), ''), nullif(entry->>'username', ''), nullif(btrim(user_id), ''), 'usuario')
      where username is null or btrim(username) = ''
    `
  );

  await queryDb(
    `
      update user_teams
      set team_name = coalesce(nullif(btrim(team_name), ''), nullif(entry->>'name', ''), id, 'Mi porra')
      where team_name is null or btrim(team_name) = ''
    `
  );

  await queryDb(
    `
      update user_teams
      set locked = true
      where locked is null
    `
  );

  await queryDb(
    `
      update user_teams
      set source = case
        when source in ('user', 'demo') then source
        when entry->>'source' in ('user', 'demo') then entry->>'source'
        else 'user'
      end
      where source is null or btrim(source) = '' or source not in ('user', 'demo')
    `
  );

  await queryDb(
    `
      update user_teams
      set created_at = now()
      where created_at is null
    `
  );

  await queryDb(
    `
      update user_teams
      set updated_at = now()
      where updated_at is null
    `
  );

  await queryDb(
    `
      update user_teams
      set entry = jsonb_set(entry, '{id}', to_jsonb(id), true)
      where coalesce(entry->>'id', '') = ''
    `
  );

  await queryDb(
    `
      update user_teams
      set entry = jsonb_set(entry, '{userId}', to_jsonb(user_id), true)
      where coalesce(entry->>'userId', '') = ''
    `
  );

  await queryDb(
    `
      update user_teams
      set entry = jsonb_set(entry, '{username}', to_jsonb(username), true)
      where coalesce(entry->>'username', '') = ''
    `
  );

  await queryDb(
    `
      update user_teams
      set entry = jsonb_set(entry, '{name}', to_jsonb(team_name), true)
      where coalesce(entry->>'name', '') = ''
    `
  );

  await queryDb(
    `
      update user_teams
      set entry = jsonb_set(
        entry,
        '{createdAt}',
        to_jsonb(to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
        true
      )
      where coalesce(entry->>'createdAt', '') = ''
    `
  );

  await queryDb(
    `
      update user_teams
      set entry = jsonb_set(entry, '{locked}', to_jsonb(coalesce(locked, true)), true)
      where entry->'locked' is null
    `
  );

  await queryDb(
    `
      update user_teams
      set entry = jsonb_set(entry, '{source}', to_jsonb(source), true)
      where coalesce(entry->>'source', '') = ''
    `
  );

  await queryDb("alter table user_teams alter column entry set default '{}'::jsonb");
  await queryDb("alter table user_teams alter column locked set default true");
  await queryDb("alter table user_teams alter column source set default 'user'");
  await queryDb("alter table user_teams alter column created_at set default now()");
  await queryDb("alter table user_teams alter column updated_at set default now()");

  await queryDb("alter table user_teams alter column user_id set not null");
  await queryDb("alter table user_teams alter column username set not null");
  await queryDb("alter table user_teams alter column team_name set not null");
  await queryDb("alter table user_teams alter column entry set not null");
  await queryDb("alter table user_teams alter column locked set not null");
  await queryDb("alter table user_teams alter column source set not null");
  await queryDb("alter table user_teams alter column created_at set not null");
  await queryDb("alter table user_teams alter column updated_at set not null");

  await queryDb(
    `
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'user_teams_source_check'
            and conrelid = 'user_teams'::regclass
        ) then
          alter table user_teams
            add constraint user_teams_source_check
            check (source in ('user', 'demo'));
        end if;
      end $$;
    `
  );

  columns = await listUserTeamsColumns();
  await ensurePredictionColumnCompatibility(columns);

  columns = await listUserTeamsColumns();
  await relaxUnexpectedRequiredColumns(columns);

  await queryDb("create index if not exists idx_user_teams_user_id on user_teams (user_id)");
  await queryDb("create index if not exists idx_user_teams_created_at on user_teams (created_at desc)");
}

async function ensureUserTeamsTableSchema() {
  if (!globalThis.__penitaUserTeamsSchemaReady__) {
    globalThis.__penitaUserTeamsSchemaReady__ = ensureUserTeamsTableSchemaImpl().catch((error) => {
      globalThis.__penitaUserTeamsSchemaReady__ = undefined;
      throw error;
    });
  }

  await globalThis.__penitaUserTeamsSchemaReady__;
}

export async function getUserTeamsStoreFromDb() {
  await ensureUserTeamsTableSchema();

  const result = await queryDb<UserTeamRow>(
    `
      select id, user_id, entry, created_at, updated_at
      from user_teams
      order by created_at desc, id desc
    `
  );

  if (result.rowCount === 0) {
    return readFallbackUserTeamsStore();
  }

  return buildStore(result.rows);
}

async function countOtherTeamsForUser(client: PoolClient, userId: string, teamId: string) {
  const result = await client.query<{ total: string }>(
    `
      select count(*)::text as total
      from user_teams
      where user_id = $1 and id <> $2
    `,
    [userId, teamId]
  );
  return Number(result.rows[0]?.total || 0);
}

export async function deleteUserTeamFromDb(teamId: string, userId?: string) {
  await ensureUserTeamsTableSchema();

  const normalizedTeamId = String(teamId || "").trim();
  if (!normalizedTeamId) {
    throw new Error("Debes indicar la porra a eliminar.");
  }

  const params: string[] = [normalizedTeamId];
  let userFilter = "";
  if (userId && String(userId).trim()) {
    params.push(String(userId).trim());
    userFilter = " and user_id = $2";
  }

  const result = await queryDb<{ id: string }>(
    `
      delete from user_teams
      where id = $1${userFilter}
      returning id
    `,
    params
  );

  if (result.rowCount === 0) {
    throw new Error("La porra no existe.");
  }

  return { id: result.rows[0].id };
}

export async function saveUserTeamToDb(rawEntry: Partial<Team>) {
  await ensureUserTeamsTableSchema();

  const entry = sanitizeUserTeam(rawEntry);

  if (!entry) {
    throw new Error("La porra no es válida.");
  }

  const savedEntry: Team = {
    ...entry,
    createdAt: entry.createdAt || new Date().toISOString(),
    locked: true,
    source: "user",
  };

  await withTransaction(async (client) => {
    const existing = await client.query<{ id: string }>(
      "select id from user_teams where id = $1 limit 1",
      [savedEntry.id]
    );

    if (existing.rowCount === 0) {
      const totalForUser = await countOtherTeamsForUser(client, savedEntry.userId, savedEntry.id);
      if (totalForUser >= 3) {
        throw new Error("Cada usuario puede tener un máximo de 3 porras.");
      }
    }

    const columns = await listUserTeamsColumnsWithClient(client);
    const predictionColumn = columns.find((column: UserTeamColumnRow) => column.column_name === "prediction");

    const insertColumns = ["id", "user_id", "username", "team_name", "entry"];
    const insertValues = ["$1", "$2", "$3", "$4", "$5::jsonb"];
    const updateAssignments = [
      "user_id = excluded.user_id",
      "username = excluded.username",
      "team_name = excluded.team_name",
      "entry = excluded.entry",
      "locked = excluded.locked",
      "source = excluded.source",
      "updated_at = now()",
    ];
    const params: unknown[] = [
      savedEntry.id,
      savedEntry.userId,
      savedEntry.username,
      savedEntry.name,
      JSON.stringify(savedEntry),
    ];

    if (predictionColumn && (isJsonColumn(predictionColumn) || isTextColumn(predictionColumn))) {
      const quotedName = escapeIdentifier(predictionColumn.column_name);
      params.push(JSON.stringify(savedEntry));
      const placeholder = `$${params.length}`;
      insertColumns.push(predictionColumn.column_name);
      insertValues.push(isJsonColumn(predictionColumn) ? `${placeholder}::${getJsonSqlType(predictionColumn)}` : placeholder);
      updateAssignments.splice(4, 0, `${quotedName} = excluded.${quotedName}`);
    }

    params.push(true);
    insertColumns.push("locked");
    insertValues.push(`$${params.length}`);

    params.push("user");
    insertColumns.push("source");
    insertValues.push(`$${params.length}`);

    params.push(savedEntry.createdAt);
    insertColumns.push("created_at");
    insertValues.push(`$${params.length}::timestamptz`);

    insertColumns.push("updated_at");
    insertValues.push("now()");

    await client.query(
      `
        insert into user_teams (
          ${insertColumns.join(",\n          ")}
        )
        values (${insertValues.join(", ")})
        on conflict (id) do update
        set
          ${updateAssignments.join(",\n          ")}
      `,
      params
    );
  });

  return savedEntry;
}
