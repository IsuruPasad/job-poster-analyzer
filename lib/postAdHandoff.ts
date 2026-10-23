// Builds what the ikman Job Poster extension (extension/) needs to fill ikman.lk's post-ad form
// for one location tab: the form's own URL, and every value already in the form's formats.
// Server-only (reads the gateway).
//
// ikman.lk's post-ad page opens straight onto a category + town's form at
// /en/post-ad/details?type=for_sale&category={id}&location={id} — the URL its own page moves to
// once both are picked. The ids come from the gateway: GET /v1/categories (cached here for a day)
// and the location tree (lib/locations).
import type { PostAdHandoff } from "@/types/job";
import { API_GATEWAY_URL } from "@/lib/apiGateway";
import { findDistrict, findTown } from "@/lib/locations";
import { getLocationData } from "@/lib/locations/server";
import { toLocalSriLankanPhone } from "@/lib/phone";

const IKMAN_POST_AD_URL = "https://ikman.lk/en/post-ad";
const CATEGORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 15_000;

interface RawCategory {
  id: number;
  name: string;
  slug: string;
  children?: number[];
  deactivated?: boolean;
}

/** ikman.lk's spellings vary in case and spacing ("Hot / Cold Kitchen Chef", double spaces), so names match without either. */
function nameKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "");
}

let categoryCache: { ids: Map<string, number>; loadedAt: number } | null = null;

/** Live job categories (the children of the "jobs" category) by nameKey. Some names exist twice, once deactivated. */
async function getJobCategoryIds(): Promise<Map<string, number>> {
  if (categoryCache && Date.now() - categoryCache.loadedAt < CATEGORY_CACHE_TTL_MS) return categoryCache.ids;

  const url = `${API_GATEWAY_URL}/v1/categories`;
  const res = await fetch(url, { headers: { "Accept-Language": "en" }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${url} failed: HTTP ${res.status}`);
  const { categories } = (await res.json()) as { categories: RawCategory[] };

  const byId = new Map(categories.map((c) => [c.id, c]));
  const ids = new Map<string, number>();
  for (const id of categories.find((c) => c.slug === "jobs")?.children ?? []) {
    const category = byId.get(id);
    if (category && !category.deactivated) ids.set(nameKey(category.name), category.id);
  }
  if (ids.size === 0) throw new Error(`GET ${url} has no live categories under "jobs"`);
  categoryCache = { ids, loadedAt: Date.now() };
  return ids;
}

/**
 * The post-ad form's URL for this job's category and town. Falls back to ikman.lk's generic Post Ad
 * page (the user picks both there, and the extension fills the form once it appears) when either
 * id can't be found — never an error, since the user is right there to pick.
 */
async function postAdUrl(job: Record<string, string>): Promise<string> {
  try {
    const [locations, categoryIds] = await Promise.all([getLocationData(), getJobCategoryIds()]);
    const town = findTown(locations, job.town, findDistrict(locations, job.district)?.name);
    const categoryId = job.jobCategory ? categoryIds.get(nameKey(job.jobCategory)) : undefined;
    if (town && categoryId) return `${IKMAN_POST_AD_URL}/details?type=for_sale&category=${categoryId}&location=${town.id}`;
    console.warn(`[post-job] ⚠ no ikman.lk id for ${!categoryId ? `category "${job.jobCategory}"` : `town "${job.district} / ${job.town}"`} — opening the generic Post Ad page`);
  } catch (err) {
    console.warn("[post-job] ⚠ couldn't look up ikman.lk's category/location ids — opening the generic Post Ad page:", err);
  }
  return IKMAN_POST_AD_URL;
}

/** First whole number in free text: "3+ years" → "3", "Rs. 10,000.00" → "10000". */
function firstNumber(value: string | undefined): string {
  return (value ?? "").replace(/,/g, "").match(/\d+/)?.[0] ?? "";
}

export async function buildPostAdHandoff(job: Record<string, string>): Promise<PostAdHandoff> {
  const text = (key: string) => (job[key] ?? "").trim();
  return {
    url: await postAdUrl(job),
    fields: {
      role: text("jobRole"),
      title: text("posterTitle"),
      description: text("description"),
      jobType: text("jobType"),
      experience: firstNumber(job.requiredExperience),
      education: text("requiredEducation"),
      salaryFrom: firstNumber(job.salaryFrom),
      // ikman.lk only keeps a salary with both ends, so a single figure becomes an equal range.
      salaryTo: firstNumber(job.salaryTo) || firstNumber(job.salaryFrom),
      employer: text("employerName"),
      website: text("employerWebsite"),
      phone: text("applicationPhone") && toLocalSriLankanPhone(text("applicationPhone")),
      deadline: text("applicationDeadline"),
    },
  };
}
