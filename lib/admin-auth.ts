import "server-only";

const ADMIN_USERNAME = "@canallita";
const ADMIN_PASSWORD = "oyarsexo";

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function isAdminCredentials(username: string, password: string) {
  return normalizeUsername(username) === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}
