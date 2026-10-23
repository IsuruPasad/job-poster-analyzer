import { NextRequest, NextResponse } from "next/server";
import type { AuthSession } from "@/types/auth";
import { API_GATEWAY_URL } from "@/lib/apiGateway";
import { UPSTREAM_TIMEOUT_MS, setAuthCookies, upstreamHeaders } from "@/lib/auth/server";

// App login: forwards to the gateway's POST /v1/sessions and persists the session as cookies.
// Never log the request body (password) or the returned token.
export async function POST(req: NextRequest) {
  let identifier: unknown;
  let password: unknown;
  try {
    ({ identifier, password } = ((await req.json()) as { session?: { identifier?: unknown; password?: unknown } })
      .session ?? {});
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof identifier !== "string" || typeof password !== "string" || !identifier || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${API_GATEWAY_URL}/v1/sessions`, {
      method: "POST",
      headers: upstreamHeaders(req, false), // never forward Authorization on login
      body: JSON.stringify({ session: { identifier, password } }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: "Error getting user session" }, { status: upstream.status });
    }

    const data = (await upstream.json()) as AuthSession;
    if (!data?.session?.token || !data?.account?.id) {
      return NextResponse.json({ error: "Unexpected login response" }, { status: 502 });
    }

    const res = NextResponse.json(data);
    setAuthCookies(req, res, data.session.token, data.account.id);
    return res;
  } catch (err) {
    console.error("Login request failed:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Error getting user session" }, { status: 502 });
  }
}
