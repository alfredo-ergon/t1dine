// Geographic AREA taxonomy: continent → region → country. This is the "browse
// by area" axis and is INDEPENDENT of cuisine/dietary tags. "Mediterranean" is
// modelled here as the Southern-Europe region (and, for non-European Med
// countries, a `mediterranean` flag) — NOT as a synonym for "Europe". Cuisine
// and dietary patterns (e.g. the Mediterranean diet) live in the food's
// `cuisineTags` / `dietaryPatternTags`, a separate dimension.

export type Continent = "Europe" | "Africa" | "Asia" | "Americas" | "Oceania";

export interface Region {
  id: string;
  name: string;
  continent: Continent;
  /** True where the region borders / belongs to the Mediterranean basin. */
  mediterranean: boolean;
  /** ISO 3166-1 alpha-2 country codes in this region. */
  countries: string[];
}

// Europe is filled out first (launch scope); other continents are scaffolded
// so the catalog can grow "by area" without reshaping the model.
export const REGIONS: Region[] = [
  {
    id: "southern-europe",
    name: "Southern Europe (Mediterranean)",
    continent: "Europe",
    mediterranean: true,
    countries: ["PT", "ES", "IT", "GR", "MT", "CY", "SI", "HR"],
  },
  {
    id: "western-europe",
    name: "Western Europe",
    continent: "Europe",
    mediterranean: false,
    countries: ["FR", "DE", "NL", "BE", "LU", "AT", "CH", "IE"],
  },
  {
    id: "northern-europe",
    name: "Northern Europe",
    continent: "Europe",
    mediterranean: false,
    countries: ["GB", "DK", "SE", "NO", "FI", "IS", "EE", "LV", "LT"],
  },
  {
    id: "eastern-europe",
    name: "Eastern Europe",
    continent: "Europe",
    mediterranean: false,
    countries: ["PL", "CZ", "SK", "HU", "RO", "BG", "UA", "RS"],
  },
  {
    id: "north-africa",
    name: "North Africa (Mediterranean)",
    continent: "Africa",
    mediterranean: true,
    countries: ["MA", "DZ", "TN", "LY", "EG"],
  },
  {
    id: "levant",
    name: "Levant & Eastern Mediterranean",
    continent: "Asia",
    mediterranean: true,
    countries: ["TR", "LB", "IL", "SY", "JO"],
  },
  // --- Scaffolding for later area rollouts (no seed data yet) ---
  { id: "north-america", name: "North America", continent: "Americas", mediterranean: false, countries: ["US", "CA", "MX"] },
  { id: "south-america", name: "South America", continent: "Americas", mediterranean: false, countries: ["BR", "AR", "CL", "CO", "PE"] },
  { id: "east-asia", name: "East Asia", continent: "Asia", mediterranean: false, countries: ["CN", "JP", "KR", "TW"] },
  { id: "south-asia", name: "South Asia", continent: "Asia", mediterranean: false, countries: ["IN", "PK", "BD", "LK"] },
];

const COUNTRY_TO_REGION: Record<string, Region> = {};
for (const region of REGIONS) {
  for (const code of region.countries) {
    COUNTRY_TO_REGION[code] = region;
  }
}

export function regionForCountry(countryCode: string): Region | undefined {
  return COUNTRY_TO_REGION[countryCode.toUpperCase()];
}

export function continentForCountry(countryCode: string): Continent | undefined {
  return regionForCountry(countryCode)?.continent;
}

export function isMediterraneanCountry(countryCode: string): boolean {
  return regionForCountry(countryCode)?.mediterranean ?? false;
}

export function regionsByContinent(continent: Continent): Region[] {
  return REGIONS.filter((r) => r.continent === continent);
}

export interface ContinentGroup {
  continent: Continent;
  regions: Region[];
}

/** The full area taxonomy grouped by continent, for a browse-by-area UI. */
export const AREA_TAXONOMY: ContinentGroup[] = (["Europe", "Africa", "Asia", "Americas", "Oceania"] as Continent[]).map(
  (continent) => ({ continent, regions: regionsByContinent(continent) }),
);
