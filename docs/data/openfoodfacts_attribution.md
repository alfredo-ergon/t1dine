# Open Food Facts — attribution and usage rules

`GET /catalog/off-lookup?barcode=<code>` (see
[`services/api/src/openFoodFacts.ts`](../../services/api/src/openFoodFacts.ts) /
[`services/api/src/modules/catalog.ts`](../../services/api/src/modules/catalog.ts))
looks up ONE packaged product by barcode from the public
[Open Food Facts (OFF)](https://openfoodfacts.org) API and maps it to a
`CanonicalFood`.

## Required attribution (must remain visible wherever OFF data is shown)

> **Data © Open Food Facts contributors, ODbL 1.0**
> https://openfoodfacts.org

This exact string is carried on every OFF-derived record as
`source.attribution` (with `source.licence = "odbl-attribution"`), and is
additionally returned as a top-level `attribution` field in the
`/catalog/off-lookup` response so a caller can render it inline without
having to reach into the food's nutrient provenance. Open Food Facts data is
published under the [Open Database Licence (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/),
which requires visible attribution wherever the data (or a derivative of it)
is displayed — this requirement is non-negotiable and must not be dropped by
any future UI that consumes this endpoint.

## How T1Dine uses OFF data — candidate-only, never authoritative

- **Low-confidence candidate, always.** Every food this lookup produces has
  `status: "candidate"` and every nutrient observation has
  `confidence: "unverified"` / `method: "declared"` (OFF's own values are
  manufacturer/contributor-declared, not independently verified by T1Dine).
  There is no code path that can turn an OFF lookup result directly into
  `status: "approved"` — see the governance contract at the top of
  `openFoodFacts.ts`.
- **User-confirmable, not auto-added.** A barcode lookup only *returns* a
  candidate for a person (or curator) to review; it is never silently
  inserted into the catalog. Keeping it requires going through the same
  candidate-review workflow as any other user/AI-submitted food (see
  `POST /catalog/submissions` and the admin approve/reject queue in
  `services/api/src/modules/admin.ts`).
- **Never overrides authoritative data.** Where an authoritative source
  already covers a food (e.g. INSA/PortFIR's BDCA for Portugal — see
  [`insa_attribution.md`](insa_attribution.md)), an OFF candidate must never
  silently replace or average against that record (CLAUDE.md: "Never merge
  conflicting food values by silently averaging them."). OFF is intended to
  extend coverage to packaged/branded products that national composition
  tables typically do not itemise, not to compete with or correct them.
- **Untrusted external input.** The OFF response is validated with zod
  before any of it is used. A product OFF itself reports as not found, an
  unreachable/erroring OFF site, a non-JSON or unrecognisable response body,
  or a product missing a usable available-carbohydrate value are all treated
  as "not usable" — T1Dine never fabricates or guesses a nutrient value to
  paper over missing or malformed upstream data (fail closed).
- **Privacy.** The raw OFF response body is never logged or otherwise
  persisted; the record's immutable-snapshot digest
  (`source.rawSnapshotSha256`) is a hash of the requested barcode only, not
  of the OFF payload itself.

## Endpoint contract

`GET /catalog/off-lookup?barcode=<8-14 digit code>` (public):

- `200 { source: "openfoodfacts", food, attribution }` — a usable candidate
  was found; `food.status` is always `"candidate"`.
- `400 { error: "invalid_barcode", ... }` — the `barcode` query parameter is
  missing, non-numeric, or not 8-14 digits long.
- `404 { error: "not_found" }` — OFF reports the product as not found, or the
  product has no usable available-carbohydrate value.
- `502 { error: "off_unavailable" }` — OFF was unreachable, responded with a
  non-2xx status, or returned a non-JSON/unrecognisable body.

## Source

- API: `https://world.openfoodfacts.org/api/v2/product/<barcode>.json`
- Licence: [Open Database Licence (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/)
- Project: https://openfoodfacts.org
