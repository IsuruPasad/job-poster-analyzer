import { NextRequest, NextResponse } from "next/server";
import { API_GATEWAY_URL } from "@/lib/apiGateway";
import { UPSTREAM_TIMEOUT_MS, clearAuthCookies, upstreamHeaders } from "@/lib/auth/server";

// Current user for the persisted token: forwards to the gateway's GET /v1/account.
// A 401 means the token is dead, so the session cookies are cleared too.
export async function GET(req: NextRequest) {
  try {
    const upstream = await fetch(`${API_GATEWAY_URL}/v1/account`, {
      headers: upstreamHeaders(req, true),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!upstream.ok) {
      const res = NextResponse.json({ error: "Error fetching account" }, { status: upstream.status });
      if (upstream.status === 401) clearAuthCookies(res);
      return res;
    }
    return NextResponse.json(await upstream.json());
  } catch (err) {
    console.error("Account request failed:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Error fetching account" }, { status: 502 });
  }
}
