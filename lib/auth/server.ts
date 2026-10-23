// Server-side helpers for the app login BFF routes (app/api/auth/*), which forward to the
// Saltside API gateway so the browser never calls it directly.
import type { NextRequest, NextResponse } from "next/server";
import type { UserAccount } from "@/types/auth";
import { API_GATEWAY_URL } from "@/lib/apiGateway";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, USER_COOKIE } from "./session";

export const UPSTREAM_TIMEOUT_MS = 30_000;

const LOCALES = ["en", "si", "ta"];

export function upstreamHeaders(req: NextRequest, withAuth: boolean): Record<string, string> {
  const lang = req.headers.get("accept-language");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept-Language": lang && LOCALES.includes(lang) ? lang : "en",
    "Application-Name": "web",
  };

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip");
  if (clientIp) headers["X-Forwarded-For"] = clientIp;

  const authorization = req.headers.get("authorization");
  if (withAuth && authorization) headers.Authorization = authorization;

  return headers;
}

// Secure only when actually served over HTTPS — a Secure cookie set over plain HTTP is
// silently dropped, which would make login look like it worked but never persist.
function isHttps(req: NextRequest): boolean {
  return req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
}

export function setAuthCookies(req: NextRequest, res: NextResponse, token: string, accountId: string) {
  const options = {
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: isHttps(req),
    httpOnly: false, // browser JS reads sessionToken to build the Authorization header
  };
  res.cookies.set(SESSION_COOKIE, token, options);
  res.cookies.set(USER_COOKIE, accountId, options);
}

/**
 * Checks a session token with the gateway's GET /v1/account (for server code that receives only
 * the cookie, not a browser Authorization header). Network failures throw.
 */
export async function verifySessionToken(token: string): Promise<{ valid: true; account: UserAccount } | { valid: false; status: number }> {
  const res = await fetch(`${API_GATEWAY_URL}/v1/account`, {
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": "en",
      "Application-Name": "web",
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) return { valid: false, status: res.status };
  return { valid: true, account: ((await res.json()) as { account: UserAccount }).account };
}

/**
 * Whether a failed verifySessionToken status means the token itself is dead (401: expired or
 * revoked, 400: malformed — e.g. a made-up cookie) rather than the check failing.
 */
export function isRejectedSession(status: number): boolean {
  return status === 400 || status === 401;
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
}
