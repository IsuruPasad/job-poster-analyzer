// The app's view of the ikman.lk location tree: districts (L1) and their towns (L2), looked up
// by name. Forms and the Playwright automation work with names, since ikman.lk's posting UI
// labels its location buttons with exactly these names. Pure — safe in the browser.
import { ROOT_ID, getChildren, getParent, getTopLevelLocations, type LocationData, type LocationItem } from "./tree";

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
const isActive = (loc: LocationItem) => !loc.deactivated;

/** All active districts, in ikman.lk's display order. */
export function getDistricts(data: LocationData): LocationItem[] {
  const fromGroups = getTopLevelLocations(data.locations, data.groups, isActive);
  return fromGroups.length > 0 ? fromGroups : getChildren(data.locations, ROOT_ID).filter(isActive);
}

/** Case-insensitive match against district names. */
export function findDistrict(data: LocationData, name: string | null | undefined): LocationItem | null {
  if (!name?.trim()) return null;
  const wanted = normalize(name);
  return getDistricts(data).find((district) => normalize(district.name) === wanted) ?? null;
}

/** Active towns of a district (by district name); [] if the district is unknown. */
export function getTowns(data: LocationData, districtName: string | null | undefined): LocationItem[] {
  const district = findDistrict(data, districtName);
  return district ? getChildren(data.locations, district.id).filter(isActive) : [];
}

/** Case-insensitive match against town names — within one district if given, otherwise across all of them. */
export function findTown(
  data: LocationData,
  name: string | null | undefined,
  districtName?: string | null
): LocationItem | null {
  if (!name?.trim()) return null;
  const wanted = normalize(name);
  const pool = districtName ? getTowns(data, districtName) : getDistricts(data).flatMap((d) => getChildren(data.locations, d.id).filter(isActive));
  return pool.find((town) => normalize(town.name) === wanted) ?? null;
}

/** The town that stands for the district itself, if ikman.lk has one — "Kandy" -> "Kandy" or "Kandy City". */
export function getDistrictTown(data: LocationData, district: LocationItem): LocationItem | null {
  const names = [normalize(district.name), `${normalize(district.name)} city`];
  const towns = getChildren(data.locations, district.id).filter(isActive);
  for (const name of names) {
    const match = towns.find((town) => normalize(town.name) === name);
    if (match) return match;
  }
  return null;
}

export interface ResolvedLocation {
  district: string | null;
  town: string | null;
}

/**
 * Maps a (possibly loose) district/town pair — e.g. from poster extraction — onto ikman.lk's
 * exact names:
 * - a known town wins: it's selected along with its parent district (the given district is
 *   only used to pick between same-named towns, and is overridden if it disagrees);
 * - a district with no town selects the district plus its district-named town ("Kandy City"), if any;
 * - a town ikman.lk doesn't list keeps the district but leaves the town blank;
 * - names in the wrong field (a district as the town, a town as the district) are still recognized.
 */
export function resolveLocation(
  data: LocationData,
  input: { district?: string | null; town?: string | null }
): ResolvedLocation {
  const district = findDistrict(data, input.district);
  const withParent = (town: LocationItem): ResolvedLocation => ({
    district: getParent(data.locations, town.id)?.name ?? null,
    town: town.name,
  });
  const withDistrictTown = (d: LocationItem): ResolvedLocation => ({
    district: d.name,
    town: getDistrictTown(data, d)?.name ?? null,
  });

  if (input.town?.trim()) {
    const town = (district && findTown(data, input.town, district.name)) || findTown(data, input.town);
    if (town) return withParent(town);
    const townIsDistrict = findDistrict(data, input.town);
    if (townIsDistrict) return withDistrictTown(townIsDistrict);
    if (district) return { district: district.name, town: null };
  } else if (district) {
    return withDistrictTown(district);
  }

  const districtIsTown = findTown(data, input.district);
  if (districtIsTown) return withParent(districtIsTown);
  return { district: null, town: null };
}

/** Compact {district, towns} list, e.g. for the extraction prompt. */
export function getLocationTaxonomy(data: LocationData): { district: string; towns: string[] }[] {
  return getDistricts(data).map((district) => ({
    district: district.name,
    towns: getChildren(data.locations, district.id).filter(isActive).map((town) => town.name),
  }));
}
