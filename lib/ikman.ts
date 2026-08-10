import { IkmanCredentials, IkmanSession } from "@/types/auth";
import { getIkmanCategoryId, getIkmanLocationId, slugify } from "./ikmanMapping";

// Both endpoints are called server-side only (from app/api/ikman-auth and app/api/post-listing)
// so the password/bearer token never reach the browser's network tab.
const IKMAN_SESSIONS_URL = "https://ikman.lk/data/sessions";
const IKMAN_POST_LISTINGS_URL = "https://ikman.lk/data/post_listings";

export type IkmanResult<T> = { success: true; data: T } | { success: false; error: string };

function parseSetCookies(setCookieHeaders: string[]): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const raw of setCookieHeaders) {
    const pair = raw.split(";")[0];
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return cookies;
}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data) {
    return String((data as { error: unknown }).error);
  }
  return fallback;
}

/**
 * Logs into ikman.lk via its real POST /data/sessions endpoint and returns the bearer
 * token used by postIkmanListing. The sessions response sets a `sessionToken` cookie
 * (the same JWT sent as `Authorization: Bearer <token>` on later requests) and a
 * `__user` cookie (account id) — captured here since ikman.lk's JSON body shape for
 * this endpoint hasn't been confirmed.
 */
export async function authenticateIkman(identifier: string, password: string): Promise<IkmanResult<IkmanSession>> {
  const res = await fetch(IKMAN_SESSIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ session: { identifier, password } }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return { success: false, error: extractErrorMessage(data, "Invalid ikman.lk email or password.") };
  }

  const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const cookies = parseSetCookies(setCookies);
  const token = cookies.sessionToken;

  if (!token) {
    return { success: false, error: "Login succeeded but ikman.lk did not return a session token." };
  }

  return { success: true, data: { token, accountId: cookies.__user } };
}

/** Best-effort "N+ years" -> integer years; returns null (property omitted) rather than guess. */
function parseExperienceYears(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Builds the { ad, account_phone_numbers } payload for POST /data/post_listings from one
 * location tab's field map (see app/job-form/page.tsx's `jobForms`). Returns an error string
 * instead of a payload when the category/location can't be resolved to ikman.lk's numeric ids —
 * see data/ikman-category-map.json / data/ikman-location-map.json.
 *
 * Known gaps (no confirmed ikman.lk property key yet, so left out of `properties`):
 * salaryFrom/salaryTo, applicationDeadline.
 */
export function buildAdPayload(job: Record<string, string>, credentials: IkmanCredentials): IkmanResult<Record<string, unknown>> {
  const categoryId = getIkmanCategoryId(job.jobCategory);
  if (categoryId == null) {
    return { success: false, error: `No ikman.lk category id mapped for "${job.jobCategory}" — add it to data/ikman-category-map.json.` };
  }

  const locationId = getIkmanLocationId(job.district, job.town);
  if (locationId == null) {
    return { success: false, error: `No ikman.lk location id mapped for "${job.town || job.district}" — add it to data/ikman-location-map.json.` };
  }

  const properties: Record<string, unknown>[] = [];
  const itemType = slugify(job.jobRole);
  if (itemType) properties.push({ key: "item_type", type: "enum", value: itemType });
  if (job.posterTitle) properties.push({ key: "title", type: "title", value: job.posterTitle });
  if (job.description) properties.push({ key: "description", type: "description", value: job.description });
  const employment = slugify(job.jobType);
  if (employment) properties.push({ key: "employment", type: "enum", value: employment });
  if (job.applicationPhone) properties.push({ key: "apply_via_multi", type: "contact_info_v2", phones: [job.applicationPhone] });
  const experienceYears = parseExperienceYears(job.requiredExperience);
  if (experienceYears != null) properties.push({ key: "experience", type: "integer", value: experienceYears });
  const minQualification = slugify(job.requiredEducation);
  if (minQualification) properties.push({ key: "min_qualification", type: "enum", value: minQualification });
  if (job.employerName) properties.push({ key: "company_name", type: "text", value: job.employerName });

  return {
    success: true,
    data: {
      ad: {
        category: categoryId,
        location: locationId,
        ai_generated: false,
        type: "for_sale",
        images: [],
        extra_images: [],
        contact_card: {
          phone_numbers: job.applicationPhone ? [job.applicationPhone] : [],
          email: credentials.email,
        },
        properties,
      },
      account_phone_numbers: false,
    },
  };
}

export async function postIkmanListing(job: Record<string, string>, credentials: IkmanCredentials, session: IkmanSession): Promise<IkmanResult<unknown>> {
  const payload = buildAdPayload(job, credentials);
  if (!payload.success) return payload;

  const res = await fetch(IKMAN_POST_LISTINGS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/plain, */*",
      Authorization: `Bearer ${session.token}`,
      "application-name": "web",
    },
    body: JSON.stringify(payload.data),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return { success: false, error: extractErrorMessage(data, "Failed to post the ad to ikman.lk.") };
  }

  return { success: true, data };
}
