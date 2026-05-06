import "server-only";
import { timingSafeEqual } from "node:crypto";
import { getDbPool } from "@/lib/db";
import { verifyScryptHash } from "@/lib/password";

function normalizeUsername(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";
  return normalized.startsWith("@") ? normalized : `@${normalized}`;
}

function usernameWithoutAt(value: string) {
  return normalizeUsername(value).replace(/^@/, "");
}

function timingSafeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

async function isEnvAdminCredentials(username: string, password: string) {
  const expectedUsername = process.env.ADMIN_USERNAME;
  if (!expectedUsername) return false;

  const normalizedInput = normalizeUsername(username);
  const normalizedExpected = normalizeUsername(expectedUsername);
  if (!normalizedInput || normalizedInput !== normalizedExpected) return false;

  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash) {
    return verifyScryptHash(password, hash);
  }

  const plainPassword = process.env.ADMIN_PASSWORD;
  return Boolean(plainPassword) && timingSafeStringEqual(password, plainPassword);
}

export async function isAdminCredentials(username: string, password: string) {
  const normalizedUsername = usernameWithoutAt(username);
  const plainPassword = String(password || "");
  if (!normalizedUsername || !plainPassword) return false;

  const pool = getDbPool();
  if (pool) {
    try {
      const result = await pool.query<{ password_hash: string }>(
        `select password_hash
         from users
         where lower(username) = $1 and role = 'admin'
         limit 1`,
        [normalizedUsername]
      );

      const row = result.rows[0];
      if (row?.password_hash && await verifyScryptHash(plainPassword, row.password_hash)) {
        return true;
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[admin-auth] DB admin auth failed, trying env fallback", error);
      }
    }
  }

  return isEnvAdminCredentials(username, plainPassword);
}
