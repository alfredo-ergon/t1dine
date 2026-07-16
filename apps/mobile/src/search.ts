// Pure, offline search + presentation helpers over the bundled catalog.
// Matches localised names and synonyms (accent-insensitive), so "pao" finds
// "Pão". No network — everything runs on-device.

import type { NutrientObservation } from "@t1dine/domain";
import type { CanonicalFood } from "@t1dine/food-schema";

import { CATALOG } from "./catalog";
import { normalise } from "./normalise";
import { colors } from "./theme";

// Re-exported for backward compatibility — the canonical definition now lives
// in ./normalise so ./foodEmoji can reuse it without importing the catalog.
export { normalise };

// Portuguese is the platform default (pt-PT), English is a toggle — so the
// primary display name defaults to pt-PT and falls back to English, then to
// whatever localised name exists first.
export function displayName(food: CanonicalFood, language: string = "pt"): string {
  const match = food.names.find((n) => n.language.startsWith(language));
  if (match) return match.name;
  const enFallback = food.names.find((n) => n.language.startsWith("en"));
  return (enFallback ?? food.names[0])?.name ?? food.id;
}

function haystack(food: CanonicalFood): string {
  return food.names
    .flatMap((n) => [n.name, ...n.synonyms])
    .map(normalise)
    .join(" ");
}

/** True when any word in `text` starts with `term`. A word boundary is the
 * start of the string or any non-alphanumeric char, so "peru" is a word-start
 * match in "peru, hamburguer" AND in "fiambre, peito de peru". */
function wordStartsWith(text: string, term: string): boolean {
  if (text.startsWith(term)) return true;
  for (let i = 1; i < text.length; i += 1) {
    const prev = text.charCodeAt(i - 1);
    const isAlnum = (prev >= 97 && prev <= 122) || (prev >= 48 && prev <= 57);
    if (!isAlnum && text.startsWith(term, i)) return true;
  }
  return false;
}

/**
 * Relevance-ranked, accent- and case-insensitive offline search.
 *
 * A food matches when EVERY whitespace-separated term appears somewhere in its
 * searchable text (names + synonyms). Results are then ranked so the most
 * on-target foods surface first — a name that *starts with* the query beats one
 * where the query is only a mid-word substring, which beats a match that only
 * hits a synonym. Ties break by shorter name, then alphabetically. Empty query
 * → the whole catalog, alphabetical.
 *
 * (Previously this sorted purely alphabetically, so searching "peru" put
 * "Fiambre, peito de peru" above "Peru inteiro…".)
 */
export function searchFoods(query: string, catalog: CanonicalFood[] = CATALOG): CanonicalFood[] {
  const q = normalise(query);
  if (q.length === 0) {
    return [...catalog].sort((a, b) => displayName(a).localeCompare(displayName(b)));
  }
  const terms = q.split(/\s+/).filter(Boolean);

  const scored: { food: CanonicalFood; score: number; name: string }[] = [];
  for (const food of catalog) {
    const hay = haystack(food);
    // AND: every term must appear somewhere in the searchable text.
    if (!terms.every((t) => hay.includes(t))) continue;

    const name = normalise(displayName(food, "pt"));
    let score: number;
    if (name.startsWith(q)) {
      score = 0; // primary name starts with the whole query
    } else if (wordStartsWith(name, terms[0]!)) {
      score = 1; // a word in the primary name starts with the first term
    } else if (name.includes(q)) {
      score = 2; // the whole query appears mid-name
    } else if (terms.every((t) => name.includes(t))) {
      score = 3; // all terms are in the primary name, but scattered
    } else {
      score = 4; // matched only via a synonym / secondary-language name
    }
    scored.push({ food, score, name });
  }

  scored.sort((a, b) => a.score - b.score || a.name.length - b.name.length || a.name.localeCompare(b.name));
  return scored.map((s) => s.food);
}

export function nutrient(food: CanonicalFood, code: string): NutrientObservation | undefined {
  return food.nutrients.find((n) => n.nutrientCode === code);
}

export function carbPer100g(food: CanonicalFood): number | undefined {
  return nutrient(food, "CHOAVL")?.value;
}

export interface ConfidenceStyle {
  /** i18n dictionary key — callers must run this through t() before display. */
  labelKey: string;
  icon: string;
  color: string;
  /** Soft background tint for chip/badge fills — always paired with `color` + `icon` + text, never colour alone. */
  bg: string;
}

// Confidence is conveyed by colour + icon + text (never colour alone) — WCAG 2.2.
// Colours come from the shared @t1dine/design-tokens confidence scale (via
// ./theme) so mobile stays visually consistent with the rest of T1Dine.
// This module has no i18n dependency, so it returns translation keys rather
// than literal English text; UI callers resolve them with useLanguage().t().
export function confidenceStyle(confidence: NutrientObservation["confidence"]): ConfidenceStyle {
  switch (confidence) {
    case "high":
      return { labelKey: "confidence.high", icon: "●", color: colors.confidenceHigh, bg: colors.confidenceHighBg };
    case "medium":
      return { labelKey: "confidence.medium", icon: "◆", color: colors.confidenceMedium, bg: colors.confidenceMediumBg };
    case "low":
      return { labelKey: "confidence.low", icon: "▲", color: colors.confidenceLow, bg: colors.confidenceLowBg };
    case "unverified":
    default:
      return { labelKey: "confidence.unverified", icon: "◌", color: colors.confidenceUnverified, bg: colors.confidenceUnverifiedBg };
  }
}

// i18n dictionary keys for each food type; resolve with useLanguage().t().
export const FOOD_TYPE_KEY: Record<CanonicalFood["type"], string> = {
  ingredient: "food.type.ingredient",
  packaged: "food.type.packaged",
  restaurant: "food.type.restaurant",
  recipe: "food.type.recipe",
  custom: "food.type.custom",
};
