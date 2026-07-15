// Display labels for the "browse by area" filters (Slice: browse by
// area/region + cuisine). `@t1dine/food-schema`'s `Region`/`AREA_TAXONOMY`
// are deliberately a single, language-neutral data dimension shared by every
// T1Dine surface (mobile, admin, API) — they carry one English `name`, not a
// localised one. Portuguese being this app's default language (CLAUDE.md /
// this app's own convention), this module supplies the PT labels for
// display only; it never changes the underlying region id used for
// filtering/matching (`regionForCountry`, `matchesRegion` server-side), so
// the two stay in lockstep with the shared taxonomy.
//
// Cuisine tags (`CanonicalFood.cuisineTags`) are free-text strings with no
// shared dictionary at all yet (a future data-strategy concern, out of
// scope here) — this module supplies best-effort PT labels for the tags the
// bundled/synthetic catalog currently uses, and falls back to the raw tag
// (capitalised) for anything unmapped, so a new/unknown tag is still shown
// legibly rather than hidden.

import type { Region } from "@t1dine/food-schema";

import type { Language } from "./i18n";

const REGION_NAME_PT: Record<string, string> = {
  "southern-europe": "Sul da Europa (Mediterrânico)",
  "western-europe": "Europa Ocidental",
  "northern-europe": "Norte da Europa",
  "eastern-europe": "Europa de Leste",
  "north-africa": "Norte de África (Mediterrânico)",
  levant: "Levante e Mediterrâneo Oriental",
  "north-america": "América do Norte",
  "south-america": "América do Sul",
  "east-asia": "Ásia Oriental",
  "south-asia": "Ásia do Sul",
};

/** Localised display name for a region — PT label when available and the
 * language is Portuguese, otherwise the shared package's English `name`. */
export function regionLabel(region: Region, language: Language): string {
  if (language === "pt") {
    return REGION_NAME_PT[region.id] ?? region.name;
  }
  return region.name;
}

const CUISINE_LABEL_PT: Record<string, string> = {
  portuguese: "portuguesa",
  mediterranean: "mediterrânica",
  italian: "italiana",
  spanish: "espanhola",
  french: "francesa",
  greek: "grega",
  moroccan: "marroquina",
  turkish: "turca",
  lebanese: "libanesa",
};

function capitalise(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

/** Localised display label for a raw cuisine tag (e.g. `"portuguese"` ->
 * `"portuguesa"` in PT). Falls back to the capitalised raw tag when there is
 * no mapping — an unmapped tag is still legible, never hidden. */
export function cuisineLabel(tag: string, language: Language): string {
  if (language === "pt") {
    return CUISINE_LABEL_PT[tag.toLowerCase()] ?? capitalise(tag);
  }
  return capitalise(tag);
}
