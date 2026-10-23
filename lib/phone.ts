// Sri Lankan phone numbers: local format is a leading 0 followed by 9 digits
// (mobile 07x or a landline area code), international format replaces the
// leading 0 with +94. Spaces/dashes are stripped before matching so users can
// type either "0771234567" or "077 123 4567".
const SRI_LANKA_PHONE_RE = /^(?:\+94|0)[1-9]\d{8}$/;

export function isValidSriLankanPhone(value: string): boolean {
  const normalized = value.replace(/[\s-]/g, "");
  return SRI_LANKA_PHONE_RE.test(normalized);
}

/**
 * Local format ("0771234567") — spaces/dashes stripped, +94 / 94 prefix turned into a leading 0,
 * and a bare 9-digit number (leading 0 dropped, e.g. stored as a number) given its 0 back.
 */
export function toLocalSriLankanPhone(value: string): string {
  const digits = value.replace(/[\s-]/g, "");
  if (digits.startsWith("+94")) return `0${digits.slice(3)}`;
  if (digits.startsWith("94") && digits.length === 11) return `0${digits.slice(2)}`;
  if (/^[1-9]\d{8}$/.test(digits)) return `0${digits}`;
  return digits;
}

/**
 * The first valid Sri Lankan number in `value` — a string, a number, or (up to two levels deep)
 * the values of an array/object such as { number: "…" } — in local format.
 */
export function findSriLankanPhone(value: unknown, depth = 0): string | undefined {
  if (typeof value === "number") value = String(value);
  if (typeof value === "string") {
    const local = toLocalSriLankanPhone(value);
    return isValidSriLankanPhone(local) ? local : undefined;
  }
  if (value && typeof value === "object" && depth < 3) {
    for (const inner of Object.values(value)) {
      const phone = findSriLankanPhone(inner, depth + 1);
      if (phone) return phone;
    }
  }
  return undefined;
}
