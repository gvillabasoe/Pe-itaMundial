import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __penitaPgPool__: Pool | undefined;
}

function readDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error(
      "Falta DATABASE_URL. Configura la variable de entorno en .env.local y en Vercel antes de usar las rutas de base de datos."
    );
  }
  return value;
}

function createPool() {
  const connectionString = readDatabaseUrl();
  const requiresSsl = /sslmode=require/i.test(connectionString);

  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: false,
    ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
  });
}

export function shouldRunRuntimeSchemaMigrations() {
  return process.env.DISABLE_RUNTIME_SCHEMA_MIGRATIONS !== "1";
}

export function getDb() {
  if (!globalThis.__penitaPgPool__) {
    globalThis.__penitaPgPool__ = createPool();
  }
  return globalThis.__penitaPgPool__;
}

export function getDbPool(): Pool | null {
  if (!process.env.DATABASE_URL?.trim()) {
    return null;
  }

  return getDb();
}

export async function queryDb<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: readonly unknown[]
): Promise<QueryResult<Row>> {
  return getDb().query<Row>(text, params as unknown[] | undefined);
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
