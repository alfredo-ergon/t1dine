// Pure, offline search + presentation helpers over the bundled catalog.
// Matches localised names and synonyms (accent-insensitive), so "pao" finds
// "Pão". No network — everything runs on-device.

import type { NutrientObservation } from "@t1dine/domain";
import type { CanonicalFood } from "@t1dine/food-schema";

import { CATALOG } from "./catalog";
import { colors } from "./theme";

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[áàâãä]/g, "a")
    .replace(/[éèêë]/g, "e")
    .replace(/[íìîï]/g, "i")
    .replace(/[óòôõö]/g, "o")
    .replace(/[úùûü]/g, "u")
    .replace(/ç/g, "c")
    .trim();
}

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

export function searchFoods(query: string, catalog: CanonicalFood[] = CATALOG): CanonicalFood[] {
  const q = normalise(query);
  if (q.length === 0) {
    return [...catalog].sort((a, b) => displayName(a).localeCompare(displayName(b)));
  }
  return catalog
    .filter((food) => haystack(food).includes(q))
    .sort((a, b) => displayName(a).localeCompare(displayName(b)));
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
