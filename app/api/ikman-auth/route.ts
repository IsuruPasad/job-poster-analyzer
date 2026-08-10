import { NextRequest, NextResponse } from "next/server";
import { authenticateIkman } from "@/lib/ikman";

export async function POST(req: NextRequest) {
  try {
    const { identifier, password } = (await req.json()) as { identifier: string; password: string };

    if (!identifier || !password) {
      return NextResponse.json({ success: false, error: "Email and password are required." }, { status: 400 });
    }

    const result = await authenticateIkman(identifier, password);

    if (!result.success) {
      return NextResponse.json(result, { status: 401 });
    }

    return NextResponse.json({ success: true, session: result.data });
  } catch (err) {
    console.error("ikman auth error:", err);
    return NextResponse.json({ success: false, error: "Failed to reach ikman.lk. Please try again." }, { status: 500 });
  }
}
