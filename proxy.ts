import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, loginPath } from "@/lib/auth/session";

// Optimistic auth check for the app pages: a non-empty sessionToken cookie counts as
// logged in (a dead token is caught later by a 401). Logged-out visitors are sent to the
// home page, which opens the login popup and returns them here afterwards.
export function proxy(req: NextRequest) {
  if (req.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  return NextResponse.redirect(new URL(loginPath(pathname + search), req.url));
}

export const config = {
  matcher: ["/upload/:path*", "/job-form/:path*"],
};
