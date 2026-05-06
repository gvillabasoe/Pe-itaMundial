import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";

export const USER_SESSION_COOKIE_NAME = "penita_user_session";
export const USER_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

type UserRole = "user" | "admin";

export interface UserSession {
  userId: string;
  username: string;
  role: UserRole;
  expiresAt: number;
}

function getUserSessionSecret() {
  return (
    process.env.USER_SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.DATABASE_URL ||
    ""
  );
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(data: string, secret: string) {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

function timingSafeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createUserSessionCookieValue(input: Omit<UserSession, "expiresAt">) {
  const secret = getUserSessionSecret();
  if (!secret) return null;

  const session: UserSession = {
    userId: String(input.userId || "").trim(),
    username: String(input.username || "").trim(),
    role: input.role === "admin" ? "admin" : "user",
    expiresAt: Date.now() + USER_SESSION_MAX_AGE * 1000,
  };

  if (!session.userId || !session.username) return null;

  const payload = base64UrlEncode(JSON.stringify(session));
  return `${payload}.${sign(payload, secret)}`;
}

export function parseUserSessionCookie(value: string | null | undefined): UserSession | null {
  const secret = getUserSessionSecret();
  if (!secret || !value) return null;

  const [payload, signature] = String(value).split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload, secret);
  if (!timingSafeStringEqual(signature, expected)) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as Partial<UserSession>;
    const session: UserSession = {
      userId: String(parsed.userId || "").trim(),
      username: String(parsed.username || "").trim(),
      role: parsed.role === "admin" ? "admin" : "user",
      expiresAt: Number(parsed.expiresAt || 0),
    };

    if (!session.userId || !session.username || !Number.isFinite(session.expiresAt)) return null;
    if (session.expiresAt <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) return rawValue.join("=");
  }
  return null;
}

export function getUserSessionFromRequest(request: Request) {
  return parseUserSessionCookie(getCookieValue(request.headers.get("cookie"), USER_SESSION_COOKIE_NAME));
}

export function applyUserSessionCookie(response: NextResponse, session: Omit<UserSession, "expiresAt">) {
  const value = createUserSessionCookieValue(session);
  if (!value) return response;

  response.cookies.set({
    name: USER_SESSION_COOKIE_NAME,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: USER_SESSION_MAX_AGE,
  });

  return response;
}

export function clearUserSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: USER_SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
