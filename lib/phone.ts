// Sri Lankan phone numbers: local format is a leading 0 followed by 9 digits
// (mobile 07x or a landline area code), international format replaces the
// leading 0 with +94. Spaces/dashes are stripped before matching so users can
// type either "0771234567" or "077 123 4567".
const SRI_LANKA_PHONE_RE = /^(?:\+94|0)[1-9]\d{8}$/;

export function isValidSriLankanPhone(value: string): boolean {
  const normalized = value.replace(/[\s-]/g, "");
  return SRI_LANKA_PHONE_RE.test(normalized);
}
