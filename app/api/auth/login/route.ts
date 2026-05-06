import { NextResponse } from "next/server";
import { scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { getDbPool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ════════════════════════════════════════════════════════════
// Auth con scrypt nativo de Node (sin dependencias externas).
//
// Los password_hash en la tabla `users` siguen el formato:
//   scrypt$<N>$<r>$<p>$<salt_b64>$<hash_b64>
//
// Donde N, r, p son parámetros estándar de scrypt y salt/hash van
// codificados en base64. Compatible con la salida de crypto.scryptSync().
//
// Por qué scrypt en lugar de bcrypt:
//   - bcrypt requiere instalar `bcryptjs` o `bcrypt` (módulo nativo)
//   - scrypt está en `node:crypto` desde Node 10, sin instalar nada
//   - scrypt es robusto, recomendado por OWASP, y resistente a GPUs
//   - Vercel ejecuta Node 20+ → scrypt disponible nativamente
// ════════════════════════════════════════════════════════════

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

interface LoginPayload {
  username: string;
  password: string;
}

function jsonError(message: string, status = 401) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * Verifica una contraseña contra un hash en formato:
 *   scrypt$<N>$<r>$<p>$<salt_b64>$<hash_b64>
 *
 * Devuelve `false` (sin lanzar) si el formato es inválido o si la
 * comparación timing-safe falla. Nunca filtra detalles del error.
 */
async function verifyScryptHash(password: string, encoded: string): Promise<boolean> {
  try {
    const parts = encoded.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;

    const N = parseInt(parts[1], 10);
    const r = parseInt(parts[2], 10);
    const p = parseInt(parts[3], 10);
    if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

    const salt = Buffer.from(parts[4], "base64");
    const expected = Buffer.from(parts[5], "base64");

    if (salt.length === 0 || expected.length === 0) return false;

    const derived = await scryptAsync(password, salt, expected.length, {
      N,
      r,
      p,
    });

    // timingSafeEqual requiere buffers del mismo tamaño
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  let payload: LoginPayload;

  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    return jsonError("Petición inválida", 400);
  }

  const username = String(payload?.username || "").trim().toLowerCase();
  const password = String(payload?.password || "");

  if (!username || !password) {
    return jsonError("Faltan credenciales", 400);
  }

  // Delay artificial uniforme (~250ms) para mitigar ataques de timing
  // que enumeran usuarios existentes basándose en la diferencia entre
  // un usuario inexistente y uno con contraseña errónea.
  const start = Date.now();

  const pool = getDbPool();
  if (!pool) {
    return jsonError("Servicio no disponible", 503);
  }

  try {
    const result = await pool.query<{
      id: string;
      username: string;
      password_hash: string;
      display_name: string;
      role: "user" | "admin";
    }>(
      `select id, username, password_hash, display_name, role
       from users
       where lower(username) = $1
       limit 1`,
      [username]
    );

    const row = result.rows[0];
    const valid = row?.password_hash
      ? await verifyScryptHash(password, row.password_hash)
      : false;

    // Pad timing a 250ms mínimo
    const elapsed = Date.now() - start;
    if (elapsed < 250) {
      await new Promise((r) => setTimeout(r, 250 - elapsed));
    }

    if (!row || !valid) {
      return jsonError("Usuario o contraseña incorrectos", 401);
    }

    return NextResponse.json(
      {
        user: {
          id: row.id,
          username: row.username,
          displayName: row.display_name,
          role: row.role,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[/api/auth/login] db error:", error);
    return jsonError("Error en el servicio de autenticación", 500);
  }
}
