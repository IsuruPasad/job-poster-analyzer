// Browser-side client for the app login BFF routes in app/api/auth/*.
import type { AuthSession, UserAccount } from "@/types/auth";
import { LOCALE, SESSION_COOKIE, clearSession, deleteCookie, getSessionToken, loginPath } from "./session";

const API_BASE = "/api/auth";

function buildHeaders(withAuth: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept-Language": LOCALE,
    "Application-Name": "web",
  };
  const token = getSessionToken();
  if (withAuth && token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export class LoginError extends Error {
  status: number;

  constructor(status: number) {
    super(`Login failed (${status})`);
    this.status = status;
  }
}

export async function login(email: string, password: string): Promise<AuthSession> {
  // A stale token on this request makes the login call fail (ikman.lk reference behaviour).
  deleteCookie(SESSION_COOKIE);

  const res = await fetch(`${API_BASE}/sessions`, {
    method: "POST",
    headers: buildHeaders(false), // never send Authorization on login
    body: JSON.stringify({ session: { identifier: email, password } }),
  });
  if (!res.ok) throw new LoginError(res.status);
  return res.json(); // the response's Set-Cookie has already persisted the session
}

// Token expired or revoked: drop the session and send the user to log in, coming back here afterwards.
export function handleUnauthorized() {
  clearSession();
  fetch(`${API_BASE}/logout`, { method: "POST" }).catch(() => {});
  window.location.href = loginPath(window.location.pathname + window.location.search);
}

// Use for every authenticated call — a 401 is handled globally. Not for login itself,
// where a 401 just means wrong credentials.
export async function authFetch(path: string, init: Omit<RequestInit, "headers"> = {}): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers: buildHeaders(true) });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Unauthorized");
  }
  return res;
}

export async function fetchAccount(): Promise<UserAccount> {
  const res = await authFetch("/account", { method: "GET" });
  if (!res.ok) throw new Error(`GET /account failed (${res.status})`);
  return (await res.json()).account;
}

// No upstream logout exists — the token isn't revoked, just forgotten.
export async function logout() {
  clearSession();
  await fetch(`${API_BASE}/logout`, { method: "POST" }).catch(() => {});
  window.location.href = "/";
}
