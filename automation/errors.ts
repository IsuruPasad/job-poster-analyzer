import { errors } from "playwright";
import type { PostJobErrorCode } from "../types/job";

/** A posting failure postJob() recognizes itself (config missing, browser window closed). */
export class PostJobError extends Error {
  readonly code: PostJobErrorCode;

  constructor(code: PostJobErrorCode, message: string) {
    super(message);
    this.name = "PostJobError";
    this.code = code;
  }
}

// Playwright colors its call logs with ANSI escapes — unreadable outside a terminal.
const ANSI_ESCAPE = /\u001b\[[0-9;]*m/g;

/**
 * Maps whatever postJob() threw to a PostJobErrorCode plus its technical text (for logs only).
 * Playwright types only its timeouts; other failures are recognized from its error messages.
 */
export function classifyPostJobError(err: unknown): { code: PostJobErrorCode; technical: string } {
  const technical = (err instanceof Error ? `${err.name}: ${err.message}` : String(err)).replace(ANSI_ESCAPE, "");

  if (err instanceof PostJobError) return { code: err.code, technical };
  if (err instanceof errors.TimeoutError) return { code: "POST_TIMEOUT", technical };
  if (/has been closed|browser has disconnected|Target closed/i.test(technical)) return { code: "POST_BROWSER_CLOSED", technical };
  if (/browserType\.launch|Executable doesn't exist|Failed to launch/i.test(technical)) return { code: "POST_BROWSER_LAUNCH_FAILED", technical };
  if (/net::ERR_|NS_ERROR_/.test(technical)) return { code: "POST_NAVIGATION_FAILED", technical };
  return { code: "POST_FAILED", technical };
}
