import sriLankaLocationsData from "@/data/sri-lanka-locations.json";

export interface DistrictEntry {
  district: string;
  towns: string[];
}

export const DISTRICTS: DistrictEntry[] = sriLankaLocationsData;

export function getDistrictNames(): string[] {
  return DISTRICTS.map((entry) => entry.district);
}

/** Popular towns for a district (not exhaustive — see data/sri-lanka-locations.json). */
export function getTownsForDistrict(district: string | null | undefined): string[] {
  if (!district) return [];
  const entry = DISTRICTS.find((d) => d.district.toLowerCase() === district.toLowerCase());
  return entry ? entry.towns : [];
}

/** Case-insensitive match against district names, returning the canonical spelling. */
export function matchDistrict(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  const entry = DISTRICTS.find((d) => d.district.toLowerCase() === trimmed);
  return entry ? entry.district : null;
}

/** Case-insensitive match against a district's towns, returning the canonical spelling. */
export function matchTown(district: string | null | undefined, town: string | null | undefined): string | null {
  if (!district || !town) return null;
  const towns = getTownsForDistrict(district);
  const trimmed = town.trim().toLowerCase();
  const found = towns.find((t) => t.toLowerCase() === trimmed);
  return found ?? null;
}

/** Finds which district a town belongs to, searching every district's town list. */
export function findDistrictByTown(town: string | null | undefined): string | null {
  if (!town) return null;
  const trimmed = town.trim().toLowerCase();
  const entry = DISTRICTS.find((d) => d.towns.some((t) => t.toLowerCase() === trimmed));
  return entry ? entry.district : null;
}
