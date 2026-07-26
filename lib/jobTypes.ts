export const JOB_TYPES: string[] = ["Full Time", "Part Time", "Contractual", "Internship", "Temporary"];

/** Case-insensitive match against the fixed job type list, returning the canonical spelling. */
export function matchJobType(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  const found = JOB_TYPES.find((t) => t.toLowerCase() === trimmed);
  return found ?? null;
}
