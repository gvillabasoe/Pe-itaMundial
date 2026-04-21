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
  created_at: Date | string;
  updated_at: Date | string;
};

const FALLBACK_PATH = path.join(process.cwd(), "data", "user-teams.json");

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

export async function getUserTeamsStoreFromDb() {
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

export async function saveUserTeamToDb(rawEntry: Partial<Team>) {
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

    await client.query(
      `
        insert into user_teams (
          id,
          user_id,
          username,
          team_name,
          entry,
          locked,
          source,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::timestamptz, now())
        on conflict (id) do update
        set
          user_id = excluded.user_id,
          username = excluded.username,
          team_name = excluded.team_name,
          entry = excluded.entry,
          locked = excluded.locked,
          source = excluded.source,
          updated_at = now()
      `,
      [
        savedEntry.id,
        savedEntry.userId,
        savedEntry.username,
        savedEntry.name,
        JSON.stringify(savedEntry),
        true,
        "user",
        savedEntry.createdAt,
      ]
    );
  });

  return savedEntry;
}
