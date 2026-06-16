// ════════════════════════════════════════════════════════════
// MODO COPA — persistencia de la configuración (Neon)
// ════════════════════════════════════════════════════════════
// Una única fila con el sorteo congelado. El resto (goles, tablas, cuadro) se
// deriva de los resultados ya guardados, así que aquí solo vive el sorteo.

import { queryDb } from "@/lib/db";
import type { CupConfig } from "@/lib/cup/types";

declare global {
  // eslint-disable-next-line no-var
  var __penitaCupSchemaReady__: Promise<void> | undefined;
}

const DEFAULT_CONFIG: CupConfig = { locked: false, seed: 0, roster: [], groups: {} };

async function ensureSchemaImpl() {
  await queryDb(
    `create table if not exists cup_config (
       id integer primary key default 1 check (id = 1),
       data jsonb not null default '{}'::jsonb,
       updated_at timestamptz not null default now()
     )`
  );
}

async function ensureSchema() {
  if (!globalThis.__penitaCupSchemaReady__) {
    globalThis.__penitaCupSchemaReady__ = ensureSchemaImpl().catch((error) => {
      globalThis.__penitaCupSchemaReady__ = undefined;
      throw error;
    });
  }
  await globalThis.__penitaCupSchemaReady__;
}

function sanitize(raw: unknown): CupConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const groupsRaw = (o.groups && typeof o.groups === "object" ? o.groups : {}) as Record<string, unknown>;
  const groups: Record<string, string[]> = {};
  for (const key of Object.keys(groupsRaw)) {
    const arr = groupsRaw[key];
    if (Array.isArray(arr)) groups[key] = arr.filter((x): x is string => typeof x === "string");
  }
  return {
    locked: Boolean(o.locked),
    seed: typeof o.seed === "number" && Number.isFinite(o.seed) ? o.seed : 0,
    roster: Array.isArray(o.roster) ? (o.roster as unknown[]).filter((x): x is string => typeof x === "string") : [],
    groups,
  };
}

export async function getCupConfigFromDb(): Promise<CupConfig> {
  await ensureSchema();
  const res = await queryDb<{ data: unknown }>("select data from cup_config where id = 1");
  if (res.rowCount === 0) return { ...DEFAULT_CONFIG };
  return sanitize(res.rows[0].data);
}

export async function saveCupConfigToDb(config: CupConfig): Promise<CupConfig> {
  await ensureSchema();
  const clean = sanitize(config);
  await queryDb(
    `insert into cup_config (id, data, updated_at)
     values (1, $1::jsonb, now())
     on conflict (id) do update set data = excluded.data, updated_at = now()`,
    [JSON.stringify(clean)]
  );
  return clean;
}
