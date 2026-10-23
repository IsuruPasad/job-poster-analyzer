import { NextRequest, NextResponse } from "next/server";
import { AIError, getAIProvider, type AIErrorKind, type AIProvider, type ImageMediaType } from "@/lib/ai";
import { EXTRACTION_SCHEMA, buildExtractionSystemPrompt, extractionPrompt, toJobDetails } from "@/lib/jobExtraction";
import { getLocationData } from "@/lib/locations/server";
import { clearAuthCookies, isRejectedSession, verifySessionToken } from "@/lib/auth/server";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { EXTRACT_ERROR_MESSAGES } from "@/lib/errorMessages";
import { MAX_UPLOAD_BYTES, formatBytes, validateImageFile } from "@/lib/uploadLimits";
import type { ApiResponse, ExtractErrorCode } from "@/types/job";

// Seconds the host (e.g. Vercel) lets this route run: Gemini gets up to 3 attempts × 60 s, and
// the upload page gives up after 180 s anyway.
export const maxDuration = 180;

const AI_ERROR_STATUS: Record<AIErrorKind, number> = {
  config: 500,
  auth: 500,
  model_not_found: 500,
  rate_limit: 429,
  unavailable: 503,
  bad_request: 400,
  refused: 422,
  truncated: 502,
  invalid_output: 502,
  network: 502,
  timeout: 504,
};

const FILE_PROBLEM_STATUS: Partial<Record<ExtractErrorCode, number>> = {
  FILE_TOO_LARGE: 413,
  FILE_NOT_IMAGE: 415,
  UNSUPPORTED_FILE_TYPE: 415,
};

interface RequestContext {
  startedAt: number;
  file?: { name: string; type: string; size: number };
  provider?: AIProvider;
}

export async function POST(req: NextRequest) {
  const ctx: RequestContext = { startedAt: Date.now() };

  // Every extraction spends the AI key's quota, so only logged-in users get one — checked
  // with the gateway, since a cookie is easy to fake.
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return fail(ctx, "NOT_LOGGED_IN", 401, "No sessionToken cookie on the request.");
  }
  try {
    const check = await verifySessionToken(token);
    if (!check.valid && isRejectedSession(check.status)) {
      const res = fail(ctx, "SESSION_EXPIRED", 401, `GET /v1/account returned ${check.status} for the app session token.`);
      clearAuthCookies(res); // same as any other 401: the session is dead
      return res;
    }
    if (!check.valid) console.warn(`[extract] ⚠ couldn't verify the session (GET /v1/account → HTTP ${check.status}) — extracting anyway`);
  } catch (err) {
    console.warn("[extract] ⚠ couldn't verify the session — extracting anyway:", err);
  }

  let file: File | null;
  try {
    const value = (await req.formData()).get("image");
    file = value instanceof File ? value : null;
  } catch (err) {
    return fail(ctx, "INVALID_REQUEST", 400, `The multipart form data couldn't be parsed: ${err instanceof Error ? err.message : err}`, { err });
  }
  if (!file) {
    return fail(ctx, "NO_IMAGE", 400, 'The request has no "image" file field.');
  }
  ctx.file = { name: file.name, type: file.type, size: file.size };

  const problem = validateImageFile(file, MAX_UPLOAD_BYTES);
  if (problem) {
    return fail(ctx, problem.code, FILE_PROBLEM_STATUS[problem.code] ?? 400, problem.message);
  }

  try {
    ctx.provider = await getAIProvider();
    // Locations are secondary: without ikman.lk's list, extraction still runs and the user picks
    // the district/town by hand.
    const locationData = await getLocationData().catch((err) => {
      console.warn("[extract] ⚠ ikman.lk locations unavailable — extracting without district/town:", err);
      return null;
    });
    const reply = await ctx.provider.generateJson({
      system: buildExtractionSystemPrompt(locationData),
      prompt: extractionPrompt(new Date().toISOString().slice(0, 10)),
      image: { mediaType: file.type as ImageMediaType, base64: Buffer.from(await file.arrayBuffer()).toString("base64") },
      schema: EXTRACTION_SCHEMA,
    });

    const result = toJobDetails(reply, locationData);
    if ("error" in result) {
      return fail(ctx, "NOT_A_JOB_POSTER", 422, `The model judged the image unusable: ${result.error}`);
    }
    return NextResponse.json<ApiResponse>({ success: true, data: result.data });
  } catch (err) {
    if (err instanceof AIError) {
      return fail(ctx, `AI_${err.kind.toUpperCase()}` as ExtractErrorCode, AI_ERROR_STATUS[err.kind], err.message, { err });
    }
    return fail(ctx, "INTERNAL_ERROR", 500, err instanceof Error ? `${err.name}: ${err.message}` : String(err), { err });
  }
}

/**
 * Logs the failure in detail to the server terminal and returns only a generic message to the
 * user — the technical detail travels in `details` for the browser console.
 */
function fail(ctx: RequestContext, code: ExtractErrorCode, status: number, technical: string, options: { err?: unknown } = {}) {
  const { err } = options;
  const message = EXTRACT_ERROR_MESSAGES[code];
  const upstream = err instanceof AIError ? err.upstream : undefined;
  const details: Record<string, unknown> = {
    technical,
    ...(ctx.provider && { provider: ctx.provider.name, model: ctx.provider.model }),
    ...(upstream && { upstream }),
    ...(ctx.file && { file: ctx.file }),
    durationMs: Date.now() - ctx.startedAt,
  };

  const lines = [
    `[extract] ✖ ${code} → HTTP ${status} after ${details.durationMs} ms`,
    `  shown    : ${message}`,
    `  detail   : ${technical}`,
  ];
  if (ctx.provider) lines.push(`  provider : ${ctx.provider.name} / ${ctx.provider.model}`);
  if (upstream) {
    const summary = [upstream.status && `HTTP ${upstream.status}`, upstream.code, upstream.reason && `(${upstream.reason})`]
      .filter(Boolean)
      .join(" ");
    lines.push(`  upstream : ${summary}${upstream.message ? ` — ${upstream.message}` : ""}`);
    if (upstream.requestId) lines.push(`  requestId: ${upstream.requestId}`);
  }
  if (ctx.file) lines.push(`  file     : "${ctx.file.name}" (${ctx.file.type || "no type"}, ${formatBytes(ctx.file.size)})`);

  // Server-side failures also get the full error chain (stack traces, SDK error as `cause`).
  if (status >= 500) {
    console.error(lines.join("\n"));
    if (err) console.error(err);
  } else {
    console.warn(lines.join("\n"));
  }

  return NextResponse.json<ApiResponse>({ success: false, error: message, code, details }, { status });
}
