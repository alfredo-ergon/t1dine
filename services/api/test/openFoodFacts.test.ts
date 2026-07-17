// Coverage for `GET /catalog/off-lookup` (Open Food Facts barcode lookup —
// see `../src/openFoodFacts.ts`). Everything here is deterministic and
// offline: `fetch` is injected via `buildApp({ offFetchImpl })`, mirroring
// the Nightscout test convention in `./nightscout.test.ts` — never a real
// network call.

import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";

const VALID_BARCODE = "5601234123457"; // 13 digits

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function offFoundPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: 1,
    status_verbose: "product found",
    code: VALID_BARCODE,
    product: {
      code: VALID_BARCODE,
      product_name: "Chocolate Digestive Biscuits",
      product_name_pt: "Bolachas de Chocolate Digestive",
      brands: "McVitie's",
      countries_tags: ["en:united-kingdom"],
      nutriments: {
        carbohydrates_100g: 65.3,
        "energy-kcal_100g": 493,
      },
      ...overrides,
    },
  };
}

describe("GET /catalog/off-lookup — found", () => {
  it("returns a candidate CanonicalFood with OFF provenance, unverified confidence, and attribution", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(offFoundPayload()));
    const app = buildApp({ offFetchImpl: fetchImpl });

    const response = await app.inject({
      method: "GET",
      url: `/catalog/off-lookup?barcode=${VALID_BARCODE}`,
    });

    expect(response.statusCode).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // The request went to the documented v2 product endpoint with the barcode.
    const calledUrl = String(fetchImpl.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("https://world.openfoodfacts.org/api/v2/product/");
    expect(calledUrl).toContain(VALID_BARCODE);
    expect(calledUrl).toContain("fields=");

    const body = response.json();
    expect(body.source).toBe("openfoodfacts");
    expect(body.attribution).toBe("Data © Open Food Facts contributors, ODbL 1.0");

    const food = body.food;
    expect(food.id).toBe(`off-${VALID_BARCODE}`);
    expect(food.type).toBe("packaged");
    expect(food.barcodes).toEqual([VALID_BARCODE]);
    // NEVER auto-approved — see the governance contract in openFoodFacts.ts.
    expect(food.status).toBe("candidate");
    expect(food.status).not.toBe("approved");

    const pt = food.names.find((n: { language: string }) => n.language === "pt-PT");
    const en = food.names.find((n: { language: string }) => n.language === "en");
    expect(pt.name).toBe("Bolachas de Chocolate Digestive");
    expect(en.name).toBe("Chocolate Digestive Biscuits");

    const carb = food.nutrients.find((n: { nutrientCode: string }) => n.nutrientCode === "CHOAVL");
    const energy = food.nutrients.find((n: { nutrientCode: string }) => n.nutrientCode === "ENERC");
    expect(carb.value).toBe(65.3);
    expect(carb.method).toBe("declared");
    expect(carb.confidence).toBe("unverified");
    expect(carb.source.sourceId).toBe("OFF");
    expect(carb.source.sourceVersion).toBe("off-v2");
    expect(carb.source.licence).toBe("odbl-attribution");
    expect(carb.source.attribution).toBe("Data © Open Food Facts contributors, ODbL 1.0");
    // No `market` — OFF's barcode database is global, not country-scoped.
    expect(carb.source.market).toBeUndefined();
    expect(typeof carb.source.rawSnapshotSha256).toBe("string");
    expect(carb.source.rawSnapshotSha256.length).toBeGreaterThan(0);

    expect(energy.value).toBe(493);
    expect(energy.unit).toBe("kcal");
  });

  it("falls back pt->en and en->pt when only one localised name is present", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        offFoundPayload({
          product_name: "Only English Name",
          product_name_pt: undefined,
        }),
      ),
    );
    const app = buildApp({ offFetchImpl: fetchImpl });

    const response = await app.inject({
      method: "GET",
      url: `/catalog/off-lookup?barcode=${VALID_BARCODE}`,
    });

    expect(response.statusCode).toBe(200);
    const food = response.json().food;
    const pt = food.names.find((n: { language: string }) => n.language === "pt-PT");
    const en = food.names.find((n: { language: string }) => n.language === "en");
    expect(pt.name).toBe("Only English Name");
    expect(en.name).toBe("Only English Name");
  });

  it("never returns status approved, however the upstream payload is shaped", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(offFoundPayload()));
    const app = buildApp({ offFetchImpl: fetchImpl });

    const response = await app.inject({
      method: "GET",
      url: `/catalog/off-lookup?barcode=${VALID_BARCODE}`,
    });

    expect(response.json().food.status).toBe("candidate");
  });
});

describe("GET /catalog/off-lookup — not found (404)", () => {
  it("returns 404 when OFF reports status: 0 (product not found)", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ status: 0, status_verbose: "product not found", code: VALID_BARCODE }),
    );
    const app = buildApp({ offFetchImpl: fetchImpl });

    const response = await app.inject({
      method: "GET",
      url: `/catalog/off-lookup?barcode=${VALID_BARCODE}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe("not_found");
  });

  it("returns 404 when the product has no carbohydrate value at all", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        offFoundPayload({
          nutriments: { "energy-kcal_100g": 200 },
        }),
      ),
    );
    const app = buildApp({ offFetchImpl: fetchImpl });

    const response = await app.inject({
      method: "GET",
      url: `/catalog/off-lookup?barcode=${VALID_BARCODE}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe("not_found");
  });

  it("returns 404 when the reported carbohydrate value is non-numeric (NaN-like string)", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        offFoundPayload({
          nutriments: { carbohydrates_100g: "unknown", "energy-kcal_100g": 200 },
        }),
      ),
    );
    const app = buildApp({ offFetchImpl: fetchImpl });

    const response = await app.inject({
      method: "GET",
      url: `/catalog/off-lookup?barcode=${VALID_BARCODE}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe("not_found");
  });

  it("returns 404 when status is 1 but no product body is present", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: 1 }));
    const app = buildApp({ offFetchImpl: fetchImpl });

    const response = await app.inject({
      method: "GET",
      url: `/catalog/off-lookup?barcode=${VALID_BARCODE}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe("not_found");
  });
});

describe("GET /catalog/off-lookup — upstream failure (502)", () => {
  it("returns 502 when the OFF site is unreachable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network unreachable");
    });
    const app = buildApp({ offFetchImpl: fetchImpl });

    const response = await app.inject({
      method: "GET",
      url: `/catalog/off-lookup?barcode=${VALID_BARCODE}`,
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error).toBe("off_unavailable");
  });

  it("returns 502 when OFF responds with a non-2xx status", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: "server error" }, 500));
    const app = buildApp({ offFetchImpl: fetchImpl });

    const response = await app.inject({
      method: "GET",
      url: `/catalog/off-lookup?barcode=${VALID_BARCODE}`,
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error).toBe("off_unavailable");
  });

  it("returns 502 when the response body is not valid JSON", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response("this is not json", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const app = buildApp({ offFetchImpl: fetchImpl });

    const response = await app.inject({
      method: "GET",
      url: `/catalog/off-lookup?barcode=${VALID_BARCODE}`,
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error).toBe("off_unavailable");
  });

  it("returns 502 when the top-level JSON shape is unrecognisable (e.g. a bare array)", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([1, 2, 3]));
    const app = buildApp({ offFetchImpl: fetchImpl });

    const response = await app.inject({
      method: "GET",
      url: `/catalog/off-lookup?barcode=${VALID_BARCODE}`,
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error).toBe("off_unavailable");
  });
});

describe("GET /catalog/off-lookup — barcode validation (400)", () => {
  it("rejects a missing barcode without ever calling fetch", async () => {
    const fetchImpl = vi.fn();
    const app = buildApp({ offFetchImpl: fetchImpl });

    const response = await app.inject({ method: "GET", url: "/catalog/off-lookup" });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid_barcode");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a non-digit barcode without ever calling fetch", async () => {
    const fetchImpl = vi.fn();
    const app = buildApp({ offFetchImpl: fetchImpl });

    const response = await app.inject({ method: "GET", url: "/catalog/off-lookup?barcode=abc12345" });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid_barcode");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a too-short barcode (fewer than 8 digits)", async () => {
    const fetchImpl = vi.fn();
    const app = buildApp({ offFetchImpl: fetchImpl });

    const response = await app.inject({ method: "GET", url: "/catalog/off-lookup?barcode=1234567" });

    expect(response.statusCode).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a too-long barcode (more than 14 digits)", async () => {
    const fetchImpl = vi.fn();
    const app = buildApp({ offFetchImpl: fetchImpl });

    const response = await app.inject({ method: "GET", url: "/catalog/off-lookup?barcode=123456789012345" });

    expect(response.statusCode).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("accepts an 8-digit barcode (minimum valid EAN-8 length)", async () => {
    const shortBarcode = "12345678";
    const fetchImpl = vi.fn(async () => jsonResponse(offFoundPayload({ code: shortBarcode })));
    const app = buildApp({ offFetchImpl: fetchImpl });

    const response = await app.inject({ method: "GET", url: `/catalog/off-lookup?barcode=${shortBarcode}` });

    expect(response.statusCode).toBe(200);
    expect(response.json().food.id).toBe(`off-${shortBarcode}`);
  });
});
