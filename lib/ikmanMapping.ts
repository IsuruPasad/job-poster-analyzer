import categoryMapData from "@/data/ikman-category-map.json";
import locationMapData from "@/data/ikman-location-map.json";

// ikman.lk's own numeric category/location ids — not derivable from our taxonomy, so these
// maps start empty. Fill them in (category name -> id, "District" or "District|Town" -> id)
// as real ids are discovered; getIkmanCategoryId/getIkmanLocationId return null until then.
const CATEGORY_IDS: Record<string, number> = categoryMapData;
const LOCATION_IDS: Record<string, number> = locationMapData;

export function getIkmanCategoryId(category: string | null | undefined): number | null {
  if (!category) return null;
  return CATEGORY_IDS[category] ?? null;
}

/** Tries the specific "District|Town" entry first, falling back to a district-only entry. */
export function getIkmanLocationId(district: string | null | undefined, town: string | null | undefined): number | null {
  if (!district) return null;
  if (town) {
    const specific = LOCATION_IDS[`${district}|${town}`];
    if (specific != null) return specific;
  }
  return LOCATION_IDS[district] ?? null;
}

// ikman.lk's enum property values are the snake_case form of our own taxonomy labels
// (e.g. "Full Time" -> "full_time", "Ordinary Level" -> "ordinary_level") — confirmed
// against the sample post_listings payload, since this app's taxonomy was transcribed
// from ikman.lk's own posting form in the first place.
export function slugify(value: string | null | undefined): string | null {
  if (!value) return null;
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return slug || null;
}
