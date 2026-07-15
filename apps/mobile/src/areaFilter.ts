// Pure, offline area/cuisine filtering over `CanonicalFood[]` (Slice: browse
// by area). Mirrors `services/api/src/catalogFilters.ts`'s `matchesRegion`/
// `matchesCuisine` so the SAME filter behaviour applies whether the app is
// online (server-filtered results) or offline (bundled catalog, filtered
// on-device) — the user sees consistent results either way.
//
// A food's region is DERIVED from its `countries[]` via `regionForCountry`
// (from `@t1dine/food-schema`) — never a separate stored field, per the
// shared area taxonomy's design (see `packages/food-schema/src/regions.ts`).

import type { CanonicalFood } from "@t1dine/food-schema";
import { regionForCountry } from "@t1dine/food-schema";

/** Matches when ANY of a food's `countries[]` resolves (via `regionForCountry`)
 * to the given region id. A food with no country mapped to a known region
 * never matches any region filter. */
export function matchesRegionId(food: CanonicalFood, regionId: string): boolean {
  const target = regionId.trim().toLowerCase();
  return food.countries.some((code) => regionForCountry(code)?.id.toLowerCase() === target);
}

/** Exact (case-insensitive) match against a food's `cuisineTags[]`. */
export function matchesCuisineTag(food: CanonicalFood, cuisine: string): boolean {
  const target = cuisine.trim().toLowerCase();
  return food.cuisineTags.some((tag) => tag.toLowerCase() === target);
}

/** Applies the optional region/cuisine filters (AND'd together, each
 * skipped when not provided) over a food list. User-created custom foods are
 * deliberately NOT passed through this filter by callers (see App.tsx) — a
 * custom food typically has no `countries`/`cuisineTags` of its own, and a
 * geography/cuisine filter should never hide a person's own saved food. */
export function filterByArea(foods: CanonicalFood[], options: { regionId?: string | null; cuisine?: string | null }): CanonicalFood[] {
  let list = foods;
  if (options.regionId) {
    list = list.filter((food) => matchesRegionId(food, options.regionId as string));
  }
  if (options.cuisine) {
    list = list.filter((food) => matchesCuisineTag(food, options.cuisine as string));
  }
  return list;
}

/** Unique, sorted list of cuisine tags present across a food list — used to
 * populate the cuisine filter's chip options from whichever catalog
 * (online or offline) is currently loaded. */
export function availableCuisineTags(foods: CanonicalFood[]): string[] {
  const tags = new Set<string>();
  for (const food of foods) {
    for (const tag of food.cuisineTags) {
      tags.add(tag);
    }
  }
  return Array.from(tags).sort();
}
