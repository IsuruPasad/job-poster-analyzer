import type { AIErrorKind } from "@/lib/ai/types";

/** A district (L1) + popular town within it (L2). Either can be null if not determinable. */
export interface JobLocation {
  district: string | null;
  town: string | null;
}

export interface JobDetails {
  posterTitle: string;
  jobRole: string;
  jobCategory: string | null;
  /** Every distinct location this job is advertised for. Empty if none mentioned; more than one means the same role is open across multiple branches/cities. */
  locations: JobLocation[];
  employerName: string;
  employerWebsite: string | null;
  description: string;
  jobType: string | null;
  requiredExperience: string | null;
  requiredEducation: string | null;
  /** Lower/upper bound of the monthly salary range. If the poster gives a single fixed figure (not a range), it goes in salaryFrom and salaryTo is null. */
  salaryFrom: string | null;
  salaryTo: string | null;
  applicationDeadline: string | null;
  /** Phone number for applicants to call — never extracted from the poster, always entered manually. */
  applicationPhone: string | null;
}

export interface ExtractResponse {
  success: true;
  data: JobDetails;
}

/**
 * Stable code for every way extraction can fail — shown next to the error message in the UI and
 * logged with full details to the browser console (client codes) or server terminal (server codes).
 */
export type ExtractErrorCode =
  // Detected in the browser, before or while uploading
  | "FILE_NOT_IMAGE"
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "FILE_EMPTY"
  | "FILE_UNREADABLE"
  | "NETWORK_ERROR"
  | "REQUEST_TIMEOUT"
  | "BAD_SERVER_RESPONSE"
  // Returned by /api/extract
  | "NO_IMAGE"
  | "INVALID_REQUEST"
  | "NOT_A_JOB_POSTER"
  | "INTERNAL_ERROR"
  | `AI_${Uppercase<AIErrorKind>}`;

export interface ExtractErrorResponse {
  success: false;
  /** User-facing message. */
  error: string;
  code: ExtractErrorCode;
  /** Technical details (provider, model, upstream HTTP status/message, …) for the browser console. */
  details?: Record<string, unknown>;
}

export type ApiResponse = ExtractResponse | ExtractErrorResponse;

/** Stable code for every way "Post Job" (POST /api/post-job → Playwright automation) can fail. */
export type PostJobErrorCode =
  // Detected in the browser
  | "NETWORK_ERROR"
  | "BAD_SERVER_RESPONSE"
  // Returned by /api/post-job
  | "POST_INVALID_REQUEST"
  | "POST_CONFIG" // JOB_SITE_URL not configured (or, for the CLI, no login credentials)
  | "POST_NOT_LOGGED_IN" // no app session cookie on the request
  | "POST_SESSION_EXPIRED" // the app session's ikman.lk token is no longer valid
  | "POST_AUTH_FAILED" // ikman.lk didn't accept the session in the automation's browser
  | "POST_BROWSER_LAUNCH_FAILED"
  | "POST_BROWSER_CLOSED" // the automation's browser window was closed mid-run
  | "POST_NAVIGATION_FAILED" // couldn't load ikman.lk
  | "POST_LOCATION_REQUIRED" // no district or town — ikman.lk's Post Ad needs a town
  | "POST_PHONE_REQUIRED" // no phone number for applications (form empty, account has none)
  | "POST_LOCATION_NOT_FOUND" // the location selector didn't open, or the district/town never appeared
  | "POST_TIMEOUT" // an expected element/page never appeared
  | "POST_FAILED";

export type PostJobResponse =
  | { success: true }
  | {
      success: false;
      /** Generic user-facing message — technical detail is only in `details` (logged to the console). */
      error: string;
      code: PostJobErrorCode;
      details?: Record<string, unknown>;
    };
