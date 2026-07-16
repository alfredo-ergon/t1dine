// Pure, adapter-independent filtering over `CanonicalFood[]` — shared by the
// public `GET /catalog/foods` search and the admin review queue's `region`
// filter. Kept out of `src/catalog.ts` (the seed-data builder) and out of
// both `FoodRepository` adapters so this logic lives in exactly one place
// regardless of which adapter (in-memory/Postgres) is active.
//
// A food's region is DERIVED from its `countries[]` via `regionForCountry`
// (from `@t1dine/food-schema`) — never stored as a separate field, per the
// shared area taxonomy's design.

import type { CanonicalFood } from "@t1dine/food-schema";
import { normaliseSearchText, regionForCountry } from "@t1dine/food-schema";

// Accent-/case-insensitive normalisation now lives in the shared
// `@t1dine/food-schema` package (`normaliseSearchText`) so the public catalog
// search, the search-indexer, and (eventually) the mobile offline catalogue
// all fold "pao"/"Pão" the same way. No other module imports this alias
// today, but it is kept so any future consumer of this file's specific name
// does not break.
export const normaliseText = normaliseSearchText;

/** Matches a food's localised names/synonyms against an already-normalised
 * query fragment (accent-insensitive substring match). */
export function matchesQuery(food: CanonicalFood, normalisedQuery: string): boolean {
  return food.names.some((localised) => {
    if (normaliseSearchText(localised.name).includes(normalisedQuery)) return true;
    return localised.synonyms.some((synonym) => normaliseSearchText(synonym).includes(normalisedQuery));
  });
}

/** Exact (case-insensitive) match against a food's `countries[]`. */
export function matchesCountry(food: CanonicalFood, country: string): boolean {
  const target = country.trim().toUpperCase();
  return food.countries.some((code) => code.toUpperCase() === target);
}

/** Matches when ANY of a food's `countries[]` resolves (via `regionForCountry`)
 * to the given region id (case-insensitive). A food with no country mapped to
 * a known region never matches any region filter. */
export function matchesRegion(food: CanonicalFood, regionId: string): boolean {
  const target = regionId.trim().toLowerCase();
  return food.countries.some((code) => regionForCountry(code)?.id.toLowerCase() === target);
}

/** Exact (case-insensitive) match against a food's `cuisineTags[]`. */
export function matchesCuisine(food: CanonicalFood, cuisine: string): boolean {
  const target = cuisine.trim().toLowerCase();
  return food.cuisineTags.some((tag) => tag.toLowerCase() === target);
}

export interface CatalogFilter {
  q?: string;
  country?: string;
  region?: string;
  cuisine?: string;
}

/** Applies `q`/`country`/`region`/`cuisine` filtering (each optional, all
 * combined with AND). An absent/blank `q` matches every food. */
export function filterFoods(foods: CanonicalFood[], filter: CatalogFilter): CanonicalFood[] {
  const normalisedQuery = filter.q && filter.q.trim().length > 0 ? normaliseSearchText(filter.q) : undefined;

  return foods.filter((food) => {
    if (normalisedQuery && !matchesQuery(food, normalisedQuery)) return false;
    if (filter.country && !matchesCountry(food, filter.country)) return false;
    if (filter.region && !matchesRegion(food, filter.region)) return false;
    if (filter.cuisine && !matchesCuisine(food, filter.cuisine)) return false;
    return true;
  });
}
