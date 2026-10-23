import { NextRequest, NextResponse } from "next/server";
import type { PostJobRun } from "@/automation/postJob";
import { clearAuthCookies, isRejectedSession, verifySessionToken } from "@/lib/auth/server";
import { SESSION_COOKIE, USER_COOKIE } from "@/lib/auth/session";
import { POST_JOB_ERROR_MESSAGES } from "@/lib/errorMessages";
import { POST_JOB_METHOD } from "@/lib/features";
import { findSriLankanPhone } from "@/lib/phone";
import { buildPostAdHandoff } from "@/lib/postAdHandoff";
import type { UserAccount } from "@/types/auth";
import type { PostJobErrorCode, PostJobResponse } from "@/types/job";

const ERROR_STATUS: Partial<Record<PostJobErrorCode, number>> = {
  POST_INVALID_REQUEST: 400,
  POST_DISABLED: 501,
  POST_LOCATION_REQUIRED: 400,
  POST_PHONE_REQUIRED: 400,
  POST_NOT_LOGGED_IN: 401,
  POST_SESSION_EXPIRED: 401,
  POST_AUTH_FAILED: 502,
  POST_NAVIGATION_FAILED: 502,
  POST_TIMEOUT: 504,
};

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  if (POST_JOB_METHOD === "off") {
    return fail("POST_DISABLED", "POST_JOB_METHOD is off for this deployment.", startedAt);
  }

  let body: { job?: unknown };
  try {
    body = await req.json();
  } catch (err) {
    return fail("POST_INVALID_REQUEST", `Request body isn't valid JSON: ${err instanceof Error ? err.message : err}`, startedAt);
  }
  if (typeof body?.job !== "object" || body.job === null) {
    return fail("POST_INVALID_REQUEST", 'Request body has no "job" object.', startedAt);
  }
  const job = body.job as Record<string, string>;

  // Post as the user logged into this app: the app session token *is* their ikman.lk login
  // token, so the automation's browser can reuse it instead of logging in again.
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return fail("POST_NOT_LOGGED_IN", "No sessionToken cookie on the request.", startedAt, job);
  }
  let accountId = req.cookies.get(USER_COOKIE)?.value;
  let account: UserAccount | undefined;
  try {
    const check = await verifySessionToken(token);
    if (check.valid) {
      account = check.account;
      accountId ??= check.account.id;
      console.info(`[post-job] posting as "${check.account.profile.name}" (ikman.lk account ${check.account.id})`);
    } else if (isRejectedSession(check.status)) {
      const res = fail("POST_SESSION_EXPIRED", `GET /v1/account returned ${check.status} for the app session token.`, startedAt, job);
      clearAuthCookies(res); // same as any other 401: the session is dead
      return res;
    } else {
      console.warn(`[post-job] ⚠ couldn't verify the session (GET /v1/account → HTTP ${check.status}) — posting anyway`);
    }
  } catch (err) {
    console.warn("[post-job] ⚠ couldn't verify the session — posting anyway:", err);
  }

  // Extension method: the user's own browser fills ikman.lk's form, so the reply is just what it needs.
  if (POST_JOB_METHOD === "extension") {
    const handoff = await buildPostAdHandoff(withApplicationPhone(job, account));
    console.info(`[post-job] handing off to the browser extension: ${handoff.url} (${Date.now() - startedAt} ms)`);
    return NextResponse.json<PostJobResponse>({ success: true, handoff });
  }

  // Imported only for the browser method: on Vercel, Playwright can't even be loaded.
  const [{ postJob }, { classifyPostJobError }] = await Promise.all([import("@/automation/postJob"), import("@/automation/errors")]);
  let run: PostJobRun;
  try {
    run = await postJob(withApplicationPhone(job, account), { session: { token, accountId } });
  } catch (err) {
    const { code, technical } = classifyPostJobError(err);
    return fail(code, technical, startedAt, job, err);
  }

  // The user finishes the ad by hand in the automation's window. Answer only once they've
  // closed it, so the job form knows it can move on to the next location.
  console.info(`[post-job] form filled in ${Date.now() - startedAt} ms — waiting for the browser window to be closed`);
  await run.windowClosed;
  console.info(`[post-job] browser window closed after ${Date.now() - startedAt} ms`);
  return NextResponse.json<PostJobResponse>({ success: true });
}

/**
 * Applications go to the job form's phone number. If that was left blank, fall back to the
 * logged-in ikman.lk account's own number (its most recently used one, or its login number).
 */
function withApplicationPhone(job: Record<string, string>, account: UserAccount | undefined): Record<string, string> {
  if ((typeof job.applicationPhone === "string" && job.applicationPhone.trim()) || !account) return job;
  const accountPhone = phoneFromAccount(account);
  if (!accountPhone) return job;
  console.info("[post-job] no phone number on the form — using the ikman.lk account's number for applications");
  return { ...job, applicationPhone: accountPhone };
}

/**
 * The first valid Sri Lankan number on the account, in local format. recent_phone_numbers'
 * entries aren't the plain strings the spec's sample shows, so findSriLankanPhone accepts
 * strings, numbers and objects alike. Logs the entries' shape — never the numbers — when none
 * is usable.
 */
function phoneFromAccount(account: UserAccount): string | undefined {
  const loginPhone = "phone_number" in account.login ? account.login.phone_number : undefined;
  const phone = findSriLankanPhone([...(account.recent_phone_numbers ?? []), loginPhone]);
  if (phone) return phone;
  const shape = (account.recent_phone_numbers ?? []).map((v) => (v && typeof v === "object" ? `{${Object.keys(v).join(",")}}` : typeof v));
  console.warn(`[post-job] ⚠ no usable phone number on the ikman.lk account (recent_phone_numbers entries: [${shape.join(", ")}])`);
  return undefined;
}

/** Logs the technical detail to the terminal and returns only a generic message (+ details for the browser console). */
function fail(code: PostJobErrorCode, technical: string, startedAt: number, job?: Record<string, string>, err?: unknown) {
  const status = ERROR_STATUS[code] ?? 500;
  const message = POST_JOB_ERROR_MESSAGES[code];
  const jobSummary = job && {
    title: job.posterTitle,
    category: job.jobCategory,
    role: job.jobRole,
    district: job.district,
    town: job.town,
  };
  const details = { technical, durationMs: Date.now() - startedAt, ...(jobSummary && { job: jobSummary }) };

  const lines = [
    `[post-job] ✖ ${code} → HTTP ${status} after ${details.durationMs} ms`,
    `  shown    : ${message}`,
    `  detail   : ${technical.split("\n")[0]}`,
  ];
  if (jobSummary) lines.push(`  job      : ${JSON.stringify(jobSummary)}`);
  console.error(lines.join("\n"));
  // Full error — stack trace plus Playwright's call log of the steps leading up to it.
  if (err) console.error(err);

  return NextResponse.json<PostJobResponse>({ success: false, error: message, code, details }, { status });
}
