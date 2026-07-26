import jobCategoriesData from "@/data/job-categories.json";

export interface JobCategoryEntry {
  category: string;
  roles: string[];
}

export const JOB_CATEGORIES: JobCategoryEntry[] = jobCategoriesData;

export function getCategoryNames(): string[] {
  return JOB_CATEGORIES.map((entry) => entry.category);
}

/** Roles selectable for a category. Falls back to the category name itself
 *  when the taxonomy has no distinct roles listed under it. */
export function getRolesForCategory(category: string | null | undefined): string[] {
  if (!category) return [];
  const entry = JOB_CATEGORIES.find(
    (c) => c.category.toLowerCase() === category.toLowerCase()
  );
  if (!entry) return [];
  return entry.roles.length > 0 ? entry.roles : [entry.category];
}

/** Case-insensitive match against the taxonomy's category names, returning the canonical spelling. */
export function matchCategory(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  const entry = JOB_CATEGORIES.find((c) => c.category.toLowerCase() === trimmed);
  return entry ? entry.category : null;
}

/** Case-insensitive match against a category's roles, returning the canonical spelling. */
export function matchRole(category: string | null | undefined, role: string | null | undefined): string | null {
  if (!category || !role) return null;
  const roles = getRolesForCategory(category);
  const trimmed = role.trim().toLowerCase();
  const found = roles.find((r) => r.toLowerCase() === trimmed);
  return found ?? null;
}

/** Finds which category a role belongs to, searching every category's role list. */
export function findCategoryByRole(role: string | null | undefined): string | null {
  if (!role) return null;
  const trimmed = role.trim().toLowerCase();
  const entry = JOB_CATEGORIES.find((c) => c.roles.some((r) => r.toLowerCase() === trimmed));
  return entry ? entry.category : null;
}
