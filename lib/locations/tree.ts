// ikman.lk location tree — a port of web-pwa's location pipeline (server/endpoints/utils/tree_utils.js).
// GET /v1/locations returns a flat array where each node lists its `children` ids, with no
// parentId and no root. buildLocationTree() adds a synthetic root (-1), a `link`, and a
// `parentId` on every node, so the tree can be walked down (children) and up (parentId).
// In practice it has two levels: district (L1) -> town/area (L2). Pure — safe in the browser.

export const ROOT_ID = -1;

export interface RawLocation {
  id: number;
  name: string;
  slug: string;
  geo_region: string;
  children: number[];
  geography?: unknown;
  deactivated?: boolean;
  old_slugs?: string[];
}

/** Display order/grouping of the top-level list. Items can point at ids missing from `locations`. */
export interface LocationGroup {
  type: string;
  name: string;
  items: Array<{ location: number; emphasize: boolean }>;
}

export interface RawLocationsResponse {
  locations: RawLocation[];
  groups: LocationGroup[];
}

export interface LocationItem {
  id: number;
  name: string;
  slug: string;
  /** "/ads/{englishSlug}"; missing only on the root. */
  link?: string;
  geo_region: string;
  children: number[];
  /** null only on the root; districts have -1. */
  parentId: number | null;
  deactivated?: boolean;
  old_slugs?: string[];
  /** Only on the root. */
  version?: string;
}

/** Keyed by id. After a JSON round-trip the keys are strings ("-1", "1506") — index with numbers or Number(key). */
export type Locations = Record<number, LocationItem>;

export interface LocationData {
  locations: Locations;
  groups: LocationGroup[];
  version: string;
}

export function buildLocationTree(
  raw: RawLocationsResponse,
  englishRaw: RawLocationsResponse,
  opts: { countryName: string; countrySlug: string; geoRegion: string; version: string }
): LocationData {
  const englishSlugById = new Map(englishRaw.locations.map((loc) => [loc.id, loc.slug]));

  // 1. link from the English slug (every locale gets English URLs); geography dropped (large, unused)
  const items: Omit<LocationItem, "parentId">[] = raw.locations.map(
    ({ id, name, slug, geo_region, children, deactivated, old_slugs }) => {
      const englishSlug = englishSlugById.get(id);
      return {
        id,
        name,
        slug,
        geo_region,
        children: children ?? [],
        ...(deactivated !== undefined && { deactivated }),
        ...(old_slugs && { old_slugs }),
        link: englishSlug ? `/ads/${englishSlug}` : "/ads",
      };
    }
  );

  // 2. synthetic root; its children are every location that has children (not "every unparented
  //    location" — the two agree for today's two-level data, but a top-level leaf would be dropped)
  const root: Omit<LocationItem, "parentId"> = {
    id: ROOT_ID,
    name: opts.countryName,
    slug: opts.countrySlug,
    geo_region: opts.geoRegion,
    version: opts.version,
    children: items.filter((loc) => loc.children.length > 0).map((loc) => loc.id),
  };

  // 3. key by id
  const byId = new Map<number, Omit<LocationItem, "parentId">>();
  [...items, root].forEach((loc) => byId.set(loc.id, loc));

  // 4. parentId via a depth-first walk from the root. Unreachable nodes are dropped, the last
  //    visit wins, and dangling child ids / cycles are skipped.
  const tree: Locations = {};
  const visit = (id: number, parentId: number | null, path: Set<number>) => {
    const node = byId.get(id);
    if (!node || path.has(id)) return;
    tree[id] = { ...node, parentId };
    const nextPath = new Set(path).add(id);
    node.children.forEach((childId) => visit(childId, id, nextPath));
  };
  visit(ROOT_ID, null, new Set());

  return { locations: tree, groups: raw.groups ?? [], version: opts.version };
}

/** Direct children of a node (ids that don't resolve are skipped). */
export function getChildren(locations: Locations, id: number): LocationItem[] {
  const node = locations[id];
  return node ? node.children.map((childId) => locations[childId]).filter(Boolean) : [];
}

/** The node's parent, or undefined for the root / an unknown id. */
export function getParent(locations: Locations, id: number): LocationItem | undefined {
  const parentId = locations[id]?.parentId;
  return parentId === null || parentId === undefined ? undefined : locations[parentId];
}

/** The top-level list, in `groups` order (not root.children order); missing ids and duplicates skipped. */
export function getTopLevelLocations(
  locations: Locations,
  groups: LocationGroup[],
  filter: (loc: LocationItem) => boolean = () => true
): LocationItem[] {
  const seen = new Set<number>();
  return groups
    .flatMap((group) => group.items.map((item) => locations[item.location]))
    .filter((loc) => loc && !seen.has(loc.id) && seen.add(loc.id))
    .filter(filter);
}
