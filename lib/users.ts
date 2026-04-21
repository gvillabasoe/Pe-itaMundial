import type { User } from "@/lib/data";

export interface UserAccount extends User {
  password: string;
}

const USER_ACCOUNTS: UserAccount[] = [
  {
    id: "u-canallita",
    username: "canallita",
    password: "oyarsexo",
    teams: [],
    favorites: [],
  },
];

function normalizeUsername(value: string) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return "";
  return normalized.startsWith("@") ? normalized.slice(1) : normalized;
}

export function getAppUsers(): User[] {
  return USER_ACCOUNTS.map(({ password, ...user }) => user);
}

export function findUserById(userId: string) {
  return getAppUsers().find((user) => user.id === userId) || null;
}

export function isUserCredentials(username: string, password: string) {
  return USER_ACCOUNTS.some(
    (account) => normalizeUsername(account.username) === normalizeUsername(username) && account.password === password
  );
}

export function findUserByCredentials(username: string, password: string) {
  const account = USER_ACCOUNTS.find(
    (entry) => normalizeUsername(entry.username) === normalizeUsername(username) && entry.password === password
  );

  if (!account) return null;

  const { password: _password, ...user } = account;
  return user;
}
