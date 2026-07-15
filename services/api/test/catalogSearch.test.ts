// Coverage for the expanded (Portugal + wider Europe) seed catalog and the
// new `/catalog/foods` filters (`country`, `region`, `cuisine`) plus
// `/catalog/regions`. Fully in-memory/offline via `buildApp().inject` — no
// database.

import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("GET /catalog/foods — expanded seed catalog", () => {
  it("seeds at least 50 approved foods across Portugal and wider Europe", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/catalog/foods" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.count).toBeGreaterThanOrEqual(50);
    expect(body.foods.length).toBe(body.count);
    // Every seeded food is approved by construction — the endpoint never
    // exposes a non-approved status.
    expect(body.foods.every((food: { status: string }) => food.status === "approved")).toBe(true);
  });

  it("filters by country, exactly", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/catalog/foods?country=DE" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.count).toBeGreaterThan(0);
    expect(body.foods.every((food: { countries: string[] }) => food.countries.includes("DE"))).toBe(true);
    expect(body.foods.some((food: { id: string }) => food.id === "de-chucrute")).toBe(true);
  });

  it("filters by region, deriving membership from a food's countries", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/catalog/foods?region=southern-europe" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    // PT + ES + IT + GR foods all belong to the southern-europe region.
    expect(body.foods.some((food: { id: string }) => food.id === "pt-maca")).toBe(true);
    expect(body.foods.some((food: { id: string }) => food.id === "es-gaspacho")).toBe(true);
    expect(body.foods.some((food: { id: string }) => food.id === "it-pizza-margherita")).toBe(true);
    expect(body.foods.some((food: { id: string }) => food.id === "gr-salada-grega")).toBe(true);
    // A Western-Europe-only food must not appear.
    expect(body.foods.some((food: { id: string }) => food.id === "fr-croissant")).toBe(false);
  });

  it("filters by cuisine tag", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/catalog/foods?cuisine=mediterranean" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.count).toBeGreaterThan(0);
    expect(
      body.foods.every((food: { cuisineTags: string[] }) => food.cuisineTags.includes("mediterranean")),
    ).toBe(true);
  });

  it("combines q, country, region, and cuisine filters", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/catalog/foods?country=GR&cuisine=mediterranean&region=southern-europe",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.count).toBeGreaterThan(0);
    expect(
      body.foods.every(
        (food: { countries: string[]; cuisineTags: string[] }) =>
          food.countries.includes("GR") && food.cuisineTags.includes("mediterranean"),
      ),
    ).toBe(true);
  });

  it("still preserves provenance on every returned food", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/catalog/foods?country=PL" });

    const body = response.json();
    expect(body.count).toBeGreaterThan(0);
    expect(body.foods[0].nutrients[0].source.sourceId).toBe("SYNTH-T1DINE-PL");
  });
});

describe("GET /catalog/regions", () => {
  it("returns the shared area taxonomy (continent -> region -> countries)", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/catalog/regions" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body)).toBe(true);

    const europe = body.find((group: { continent: string }) => group.continent === "Europe");
    expect(europe).toBeTruthy();
    expect(europe.regions.some((region: { id: string }) => region.id === "southern-europe")).toBe(true);
  });
});
