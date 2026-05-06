import "server-only";

const ADMIN_USERNAME = "@canallita";
const ADMIN_PASSWORD = "oyarsexo";

function normalizeUsername(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";
  return normalized.startsWith("@") ? normalized : `@${normalized}`;
}

export function isAdminCredentials(username: string, password: string) {
  return normalizeUsername(username) === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}
