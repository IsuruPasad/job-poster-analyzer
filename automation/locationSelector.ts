// Drives ikman.lk's shared location selector (the Post Ad / Home page modal — NOT the SERP's
// multi-select location filter, which shares the `location-selector-` prefix but has other
// hooks). Follows Saltside's "Selecting a location with web automation" guide: every hook is a
// data-testid (siteConfig.locationPicker), and options are matched by data-option-key, ikman.lk's
// location id — the same ids as our location tree (lib/locations) and the same in every language.
import { errors, type Locator, type Page } from "playwright";
import { findDistrict, findTown } from "../lib/locations";
import { getLocationData } from "../lib/locations/server";
import { siteConfig } from "./config/site.config";
import { PostJobError } from "./errors";

export interface LocationChoice {
  district: { name: string; id?: number };
  town: { name: string; id?: number };
}

const tid = (testId: string) => `[data-testid="${testId}"]`;

/**
 * The job's district/town with their ikman.lk location ids. Without an id (location tree
 * unavailable, or a name it doesn't have) options are matched by data-option-label instead,
 * which only works in the page's language (English here).
 */
export async function resolveLocationChoice(job: Record<string, string>): Promise<LocationChoice> {
  const choice: LocationChoice = { district: { name: job.district }, town: { name: job.town } };
  try {
    const data = await getLocationData();
    const district = findDistrict(data, job.district);
    const town = district ? findTown(data, job.town, district.name) : null;
    if (!district || !town) {
      console.warn(`[post-job] ⚠ "${job.district} / ${job.town}" isn't in ikman.lk's location tree — matching options by label instead of id`);
    }
    choice.district.id = district?.id;
    choice.town.id = town?.id;
  } catch (err) {
    console.warn("[post-job] ⚠ couldn't load ikman.lk location ids — matching options by label instead:", err);
  }
  return choice;
}

function option(scope: Locator, choice: { name: string; id?: number }): Locator {
  const { option } = siteConfig.locationPicker;
  const match = choice.id !== undefined ? `[data-option-key="${choice.id}"]` : `[data-option-label="${choice.name}"]`;
  return scope.locator(`${tid(option)}${match}`);
}

/**
 * Picks a city in an open, ready selector: click the district in the primary column (this
 * only *opens* it), wait for that district's secondary column, click the city there, confirm
 * via the footer if this page has one, and wait for the dialog to close. Works on both layouts
 * (desktop ≥ 800px: two columns side by side; mobile: the city list replaces the districts).
 */
export async function pickCity(page: Page, choice: LocationChoice): Promise<void> {
  const ids = siteConfig.locationPicker;
  const content = page.locator(tid(ids.content));

  // Always scope to a column: a district and a city can share a name.
  await option(content.locator(tid(ids.primaryColumn)), choice.district).click();

  const districtColumn = choice.district.id !== undefined
    ? `[data-option-key="${choice.district.id}"]`
    : `[data-option-label="${choice.district.name}"]`;
  const secondary = content.locator(`${tid(ids.secondaryColumn)}${districtColumn}`);
  await secondary.waitFor();
  await option(secondary, choice.town).click();

  // Pages with a Reset/Show footer only commit the pick on "Show" (none expected on Post Ad).
  const apply = page.locator(tid(ids.apply));
  if (await apply.isVisible()) {
    await page.locator(tid(ids.loading)).waitFor({ state: "hidden" });
    await apply.click();
  }
  await content.waitFor({ state: "hidden" });
}

/**
 * Post Ad: opens the selector if picking the category didn't already open it, waits until it's
 * ready, then picks the city. Every failure becomes a POST_LOCATION_NOT_FOUND PostJobError
 * whose technical text says which step stalled.
 */
export async function selectJobLocation(page: Page, choice: LocationChoice): Promise<void> {
  const ids = siteConfig.locationPicker;
  const content = page.locator(tid(ids.content));
  const trigger = page.locator(tid(ids.trigger));
  const loadError = page.locator(tid(ids.loadError));
  let step = "opening the location selector";

  try {
    await content.or(trigger).first().waitFor();
    if (!(await content.isVisible())) {
      // Give an auto-opening selector a moment, so we don't click the trigger behind it.
      await content.waitFor({ timeout: 3_000 }).catch(() => {});
    }
    if (!(await content.isVisible())) {
      if ((await trigger.getAttribute("data-disabled")) === "true") {
        throw new PostJobError("POST_LOCATION_NOT_FOUND", "ikman.lk's location button is disabled (data-disabled=true).");
      }
      await trigger.click();
    }
    // The selector code loads lazily: it's ready once its content is visible.
    await content.or(loadError).first().waitFor();
    if (await loadError.isVisible()) {
      throw new PostJobError("POST_LOCATION_NOT_FOUND", "ikman.lk's location selector failed to load its location list.");
    }

    step = `picking district "${choice.district.name}" (id ${choice.district.id ?? "?"}) → town "${choice.town.name}" (id ${choice.town.id ?? "?"})`;
    await pickCity(page, choice);
  } catch (err) {
    if (err instanceof errors.TimeoutError) {
      throw new PostJobError("POST_LOCATION_NOT_FOUND", `Location selector stalled while ${step}. ${err.message}`);
    }
    throw err;
  }
}
