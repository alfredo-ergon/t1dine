"use client";

import type { CanonicalFood, ContinentGroup, Region } from "@t1dine/food-schema";
import { AREA_TAXONOMY, regionForCountry } from "@t1dine/food-schema";
import { useEffect, useMemo, useState } from "react";
import { fetchCatalogFoods, fetchRegions } from "../lib/adminApi";
import { enrichCanonicalFood } from "../../lib/catalog";
import { FOOD_TYPE_LABELS, t } from "../../lib/i18n";
import { Chip } from "../ui/Chip";
import { Mascot } from "../ui/Mascot";

/** Region id → its foods, for the grouped overview. */
type RegionBuckets = Map<string, CanonicalFood[]>;

function firstCountry(food: CanonicalFood): string | null {
  const countries = Array.isArray(food.countries) ? food.countries : [];
  return countries.length > 0 ? countries[0] : null;
}

function bucketByRegion(foods: CanonicalFood[]): RegionBuckets {
  const buckets: RegionBuckets = new Map();
  for (const food of foods) {
    const country = firstCountry(food);
    const region = country ? regionForCountry(country) : undefined;
    const key = region?.id ?? "__unmapped__";
    const existing = buckets.get(key);
    if (existing) existing.push(food);
    else buckets.set(key, [food]);
  }
  return buckets;
}

function AreaFoodsTable({ foods }: { foods: CanonicalFood[] }): JSX.Element {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>{t.areas.columns.name}</th>
            <th>{t.areas.columns.type}</th>
            <th>{t.areas.columns.country}</th>
            <th>{t.areas.columns.cuisine}</th>
            <th className="num">{t.areas.columns.carb}</th>
            <th className="num">{t.areas.columns.energy}</th>
          </tr>
        </thead>
        <tbody>
          {foods.map((food) => {
            const enriched = enrichCanonicalFood(food);
            const cuisine = Array.isArray(food.cuisineTags) ? food.cuisineTags : [];
            return (
              <tr key={food.id}>
                <td className="cell-name">{enriched.primaryName}</td>
                <td>{FOOD_TYPE_LABELS[food.type] ?? String(food.type)}</td>
                <td className="mono">{firstCountry(food) ?? "—"}</td>
                <td>{cuisine.length > 0 ? cuisine.join(", ") : "—"}</td>
                <td className="num">{enriched.carbPer100g === null ? "—" : `${enriched.carbPer100g} g`}</td>
                <td className="num">{enriched.energyKcalPer100g === null ? "—" : `${enriched.energyKcalPer100g} kcal`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AreaOverview({ taxonomy, foods }: { taxonomy: ContinentGroup[]; foods: CanonicalFood[] }): JSX.Element {
  const buckets = useMemo(() => bucketByRegion(foods), [foods]);

  const continentSections = taxonomy
    .map((group) => ({
      continent: group.continent,
      regions: group.regions.filter((region) => (buckets.get(region.id)?.length ?? 0) > 0),
    }))
    .filter((section) => section.regions.length > 0);

  const unmapped = buckets.get("__unmapped__") ?? [];

  if (continentSections.length === 0 && unmapped.length === 0) {
    return (
      <div className="empty-state">
        <Mascot size={56} mono="#CBD5E1" decorative />
        <p className="empty-state__title">{t.areas.noneTitle}</p>
        <p className="empty-state__hint">{t.areas.noneHint}</p>
      </div>
    );
  }

  return (
    <>
      {continentSections.map((section) => (
        <section key={section.continent} className="area-continent">
          <h2 className="section-title">{section.continent}</h2>
          {section.regions.map((region) => (
            <AreaRegionPanel key={region.id} region={region} foods={buckets.get(region.id) ?? []} />
          ))}
        </section>
      ))}
    </>
  );
}

function AreaRegionPanel({ region, foods }: { region: Region; foods: CanonicalFood[] }): JSX.Element {
  return (
    <div className="panel area-region">
      <div className="area-region__head">
        <h3 className="area-region__title">{region.name}</h3>
        {region.mediterranean && <Chip variant="accent" label={t.areas.mediterraneanBadge} />}
        <span className="area-region__count">
          {foods.length} {t.areas.foods}
        </span>
      </div>
      <AreaFoodsTable foods={foods} />
    </div>
  );
}

function BrowseByArea(): JSX.Element {
  const [taxonomy, setTaxonomy] = useState<ContinentGroup[]>(AREA_TAXONOMY);
  const [allFoods, setAllFoods] = useState<CanonicalFood[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [regionFoods, setRegionFoods] = useState<CanonicalFood[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial load: taxonomy (falls back to the bundled constant) + all approved
  // foods for the grouped overview.
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [regions, foods] = await Promise.all([fetchRegions(), fetchCatalogFoods({})]);
        if (!active) return;
        setTaxonomy(regions);
        setAllFoods(foods);
      } catch {
        if (active) setError(t.areas.error);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // When a specific area is selected, use the API's `region=` filter so the
  // catalog does the work (region is DERIVED from each food's country).
  useEffect(() => {
    if (selectedRegion === "all") {
      setRegionFoods(null);
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const foods = await fetchCatalogFoods({ region: selectedRegion });
        if (active) setRegionFoods(foods);
      } catch {
        if (active) setError(t.areas.error);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedRegion]);

  const selectedRegionMeta = useMemo(
    () => taxonomy.flatMap((group) => group.regions).find((region) => region.id === selectedRegion),
    [taxonomy, selectedRegion],
  );

  return (
    <>
      <p className="callout callout--info" role="note">
        {t.areas.axisNote}
      </p>

      <div className="controls">
        <div className="field">
          <label htmlFor="area-select">{t.areas.filterArea}</label>
          <select id="area-select" value={selectedRegion} onChange={(event) => setSelectedRegion(event.target.value)}>
            <option value="all">{t.areas.allAreas}</option>
            {taxonomy.map((group) => (
              <optgroup key={group.continent} label={group.continent}>
                {group.regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="callout callout--danger" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="table-wrap" role="status" aria-live="polite" style={{ padding: "1.1rem 1.2rem" }}>
          <p className="muted" style={{ margin: "0 0 0.85rem" }}>
            {t.areas.loading}
          </p>
          {[0, 1, 2, 3].map((row) => (
            <span
              key={row}
              className="skeleton"
              style={{ display: "block", height: "1.9rem", margin: "0.55rem 0", width: `${92 - row * 7}%` }}
            />
          ))}
        </div>
      ) : selectedRegion === "all" ? (
        <AreaOverview taxonomy={taxonomy} foods={allFoods} />
      ) : (
        <div className="panel area-region">
          <div className="area-region__head">
            <h3 className="area-region__title">{selectedRegionMeta?.name ?? selectedRegion}</h3>
            {selectedRegionMeta?.mediterranean && <Chip variant="accent" label={t.areas.mediterraneanBadge} />}
            <span className="area-region__count">
              {(regionFoods ?? []).length} {t.areas.foods}
            </span>
          </div>
          {(regionFoods ?? []).length > 0 ? (
            <AreaFoodsTable foods={regionFoods ?? []} />
          ) : (
            <p className="muted">{t.areas.noneInArea}</p>
          )}
        </div>
      )}
    </>
  );
}

export default function AreasPage(): JSX.Element {
  return (
    <>
      <h1 className="page-title">{t.areas.title}</h1>
      <p className="page-lede">{t.areas.lede}</p>
      <BrowseByArea />
    </>
  );
}
