import { NextRequest, NextResponse } from "next/server";
import { postJob } from "@/automation/postJob";
import { IkmanCredentials } from "@/types/auth";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { job: Record<string, string>; credentials?: IkmanCredentials };
    await postJob(body.job, body.credentials);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("postJob automation error:", err);
    const message = err instanceof Error ? err.message : "Automation failed.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
