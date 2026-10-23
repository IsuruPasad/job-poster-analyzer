// Loads ikman.lk's location tree from the API gateway (GET /v1/locations), builds it once and
// keeps it in memory for a day — it rarely changes. Server-only (reads API_GATEWAY_URL).
import { API_GATEWAY_URL } from "@/lib/apiGateway";
import { buildLocationTree, type LocationData, type RawLocationsResponse } from "./tree";
import { getDistricts } from "./lookup";

const LOCALE = "en";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 15_000;

let cache: { data: LocationData; loadedAt: number } | null = null;
let inflight: Promise<LocationData> | null = null;

async function fetchLocationTree(): Promise<LocationData> {
  const url = `${API_GATEWAY_URL}/v1/locations`;
  const startedAt = Date.now();
  const res = await fetch(url, {
    headers: { "Accept-Language": LOCALE },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET ${url} failed: HTTP ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 300)}` : ""}`);
  }

  const raw = (await res.json()) as RawLocationsResponse;
  if (!Array.isArray(raw?.locations)) {
    throw new Error(`GET ${url} returned an unexpected body (no "locations" array)`);
  }

  // English only, so the English response doubles as the source of each node's link slug.
  const data = buildLocationTree(raw, raw, {
    countryName: "Sri Lanka",
    countrySlug: "sri-lanka",
    geoRegion: "SL",
    version: res.headers.get("version") ?? "1.0",
  });
  const districts = getDistricts(data);
  console.info(
    `[locations] loaded ${districts.length} districts / ${raw.locations.length - districts.length} towns ` +
      `(version ${data.version}) from ${url} in ${Date.now() - startedAt} ms`
  );
  if (districts.length === 0) throw new Error(`GET ${url} returned no districts`);
  return data;
}

/** The location tree, cached for a day. A failed refresh keeps serving the last good copy. */
export async function getLocationData(): Promise<LocationData> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.data;

  inflight ??= fetchLocationTree()
    .then((data) => {
      cache = { data, loadedAt: Date.now() };
      return data;
    })
    .catch((err) => {
      if (cache) {
        console.warn("[locations] ⚠ refresh failed — still serving the copy loaded at", new Date(cache.loadedAt).toISOString(), err);
        return cache.data;
      }
      throw err;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
