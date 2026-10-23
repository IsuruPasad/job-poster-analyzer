import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth/server";

// There's no upstream logout call — logging out only clears the session cookies.
export function POST() {
  const res = new NextResponse(null, { status: 204 });
  clearAuthCookies(res);
  return res;
}
