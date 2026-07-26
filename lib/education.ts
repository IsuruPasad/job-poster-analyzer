export const EDUCATION_LEVELS: string[] = [
  "Ordinary Level",
  "Advanced Level",
  "Certificate",
  "Diploma",
  "Higher Diploma",
  "Degree",
  "Master",
  "Doctorate",
  "Skilled Apprentice",
];

/** Case-insensitive match against the fixed education level list, returning the canonical spelling. */
export function matchEducation(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  const found = EDUCATION_LEVELS.find((e) => e.toLowerCase() === trimmed);
  return found ?? null;
}
