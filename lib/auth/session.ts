// App login session, mirroring ikman.lk's web-pwa: the token lives in a non-HttpOnly
// cookie for 30 days, and a non-empty cookie alone means "logged in". It's validated
// lazily — a dead token is only discovered when an authenticated call returns 401.
// Safe to import from server code (proxy, route handlers): the browser-only helpers
// below touch `document` only when called.

export const SESSION_COOKIE = "sessionToken";
export const USER_COOKIE = "__user";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // fixed from login, not renewed

export const LOCALE = "en";

export const REDIRECT_PARAM = "redirect-url";
export const DEFAULT_AFTER_LOGIN = "/upload";

// The login popup lives on the home page, so "go log in" means "/" with a redirect-url.
export function loginPath(returnTo: string): string {
  return `/?${REDIRECT_PARAM}=${encodeURIComponent(returnTo)}`;
}

// Only same-origin relative paths, to avoid an open redirect ("//evil.com", "/\evil.com").
export function safeRedirect(url: unknown, fallback: string): string {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\")
    ? url
    : fallback;
}

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const entry = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  if (!entry) return null;
  return decodeURIComponent(entry.slice(name.length + 1)) || null; // empty value = logged out
}

export function deleteCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; Path=/`;
}

export const getSessionToken = () => readCookie(SESSION_COOKIE);

export function clearSession() {
  deleteCookie(SESSION_COOKIE);
  deleteCookie(USER_COOKIE);
}
