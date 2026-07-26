const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a string in the exact YYYY-MM-DD format the native <input type="date"> expects. */
export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE_RE.test(value);
}
