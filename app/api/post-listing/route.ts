import { NextRequest, NextResponse } from "next/server";
import { postIkmanListing } from "@/lib/ikman";
import { IkmanCredentials, IkmanSession } from "@/types/auth";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      job: Record<string, string>;
      credentials: IkmanCredentials;
      session: IkmanSession | null;
    };

    if (!body.session?.token) {
      return NextResponse.json({ success: false, error: "Not authenticated with ikman.lk." }, { status: 401 });
    }

    const result = await postIkmanListing(body.job, body.credentials, body.session);
    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (err) {
    console.error("post-listing error:", err);
    return NextResponse.json({ success: false, error: "Failed to reach ikman.lk. Please try again." }, { status: 500 });
  }
}
