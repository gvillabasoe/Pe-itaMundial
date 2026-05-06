export const ADMIN_COOKIE_NAME = "penita_admin";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

function getAdminSessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.DATABASE_URL ||
    ""
  );
}

function bytesToBase64Url(bytes: Uint8Array) {
  const bufferCtor = (globalThis as typeof globalThis & { Buffer?: { from(input: Uint8Array): { toString(encoding: string): string } } }).Buffer;
  if (bufferCtor) {
    return bufferCtor.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSha256(data: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return bytesToBase64Url(new Uint8Array(signature));
}

function timingSafeStringEqual(left: string, right: string) {
  if (left.length !== right.length) return false;

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

export async function createAdminSessionCookieValue(now = Date.now()) {
  const secret = getAdminSessionSecret();
  if (!secret) return null;

  const expiresAt = now + ADMIN_SESSION_MAX_AGE * 1000;
  const payload = `admin:${expiresAt}`;
  const signature = await hmacSha256(payload, secret);
  return `${expiresAt}.${signature}`;
}

export async function isValidAdminSessionValue(value: string | null | undefined, now = Date.now()) {
  const secret = getAdminSessionSecret();
  if (!secret || !value) return false;

  const [expiresAtRaw, signature] = String(value).split(".");
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= now || !signature) return false;

  const expected = await hmacSha256(`admin:${expiresAt}`, secret);
  return timingSafeStringEqual(signature, expected);
}
