# Food Ingestion

Python workers for immutable snapshots, schema validation, deterministic mapping, nutrient normalisation, quality checks, candidate generation, and promotion workflows. Each source has an adapter and contract tests.

Stdlib + `openpyxl` only (no pandas/pydantic). Python 3.12+.

## PortFIR (INSA BDCA) adapter

`food_ingestion/portfir/` is the first concrete adapter: it turns the
Portuguese **INSA/PortFIR Base de Dados da Composição de Alimentos (BDCA)**
workbook (`docs/data/insa_tca.xlsx`, currently v7.1-2026, 1376 food records,
48 nutrient columns) into `CanonicalFood` candidates, reconciled with the
catalog already shipped under `sourceId: "INSA-BDCA"` (see
`docs/data/insa_attribution.md` and
`services/api/src/catalogData/insaBuilder.ts`). Excel-specific logic lives
only here -- it never leaks into `packages/`, `services/api`, or the apps.

### Pipeline

`profiler` (read-only structural profile) -> `parser` (fail-closed
structural parse into immutable `PortfirSourceRecord` staging records) ->
`quality` (findings + quarantine classification) -> `canonical`
(`CanonicalFood` promotion for quality-clean records) -> `reporting`
(NDJSON + validation-report writers, immutable snapshot copy) -> `diff`
(snapshot-to-snapshot comparison, never-delete deprecation).

### Commands

Run from `services/food-ingestion/`:

```bash
# Read-only structural profile (sha256, sheet/column layout, missing-value
# counts, duplicate Cod detection). Never writes to the input file.
python -m food_ingestion.portfir.profile --input ../../docs/data/insa_tca.xlsx [--output <dir>]

# Parse + run quality checks; writes validation-report.json/.md.
# Exits 1 if any ERROR-severity finding was raised (workbook data quality
# problem), 2 if the workbook's structure has drifted, 0 otherwise.
python -m food_ingestion.portfir.validate --input ../../docs/data/insa_tca.xlsx [--output <dir>] [--now <iso8601>]

# Parse, validate, promote quality-clean records to CanonicalFood NDJSON,
# and write a raw-staging NDJSON + validation report + immutable snapshot
# copy of the workbook.
python -m food_ingestion.portfir.import_data --input ../../docs/data/insa_tca.xlsx --dry-run --now 2026-07-16T00:00:00Z [--output <dir>]

# Diff two canonical NDJSON snapshots by food id.
python -m food_ingestion.portfir.diff --previous <old>/candidates.ndjson --current <new>/candidates.ndjson [--output <dir>]
```

`--now` sets `import_timestamp` / `source.retrievedAt`. When omitted it
defaults to the fixed constant `1970-01-01T00:00:00Z` so output stays
reproducible without it; real (non-test) runs should always pass an
explicit `--now`. `import_timestamp` is never part of the
determinism/equality comparison of canonical records -- see
`canonical.strip_volatile` / `canonical.content_hash`, used by both the
idempotency tests and `diff`.

### Publish status: no licence gate

This dataset is **already reconciled and shipped** as an approved catalog
under `sourceId: "INSA-BDCA"` (see `docs/data/insa_attribution.md`) -- there
is **no `PORTFIR_PUBLISH_ENABLED` gate** in this package. Quality-clean
records are promoted straight to `CanonicalFood.status: "approved"`.
`import_data --dry-run` is the safe default for previewing output (writes
under `<output>/dry-run/`); a non-dry-run run writes the same NDJSON shape
under `<output>/published/`. Neither mode talks to a database or API --
this package only ever writes local files. Records that fail quality
checks (see below) are **quarantined**: excluded from the canonical NDJSON,
but preserved unmutated in the raw-staging NDJSON and the validation report
for audit and re-review.

### Quality checks (severity `error` quarantines; `warning` does not)

| Check | Severity | Notes |
|---|---|---|
| Negative nutrient value | error | never possible in a genuine composition table |
| Single macro > 100 g/100g\|ml | error | physically impossible |
| Macro sum (FAT+CHOAVL+PROCNT+WATER+ASH+ALC+FIBTG) > 120 g | error | grossly broken (e.g. a misplaced decimal) |
| Macro sum > 105 g (and <= 120 g) | warning | normal analytical variance for independently-measured macros (cured cheeses, dried fruit/nuts, flours, wines, ...); verified against the real v7.1-2026 export |
| Energy consistency (kJ vs kcal x 4.184, ±5%) | warning | |
| Fibre grossly exceeds available carbohydrate | warning | soft sanity signal, not a rule (genuinely fibrous low-carb foods exist) |
| Missing food name | error | |
| Unknown nutrient unit | error | defensive tripwire; unreachable via the normal parse path |
| Duplicate `Cod` | error | both/all sharing rows are quarantined -- never guess which is authoritative |
| Level-1/Level-3 label near-duplicates | warning | includes the known BDCA v7.1-2026 "Leguminosas..." Level-1 spelling variant |

### Determinism and idempotency

Same workbook bytes (same SHA-256) + same `--now` -> byte-identical
canonical NDJSON, always. No time/random-based values are introduced
anywhere in the deterministic path except the caller-supplied `--now`.
Canonical foods are sorted by `Cod` (numeric, then string) so ordering never
depends on dict/set iteration. `content_hash()` strips `retrievedAt` before
hashing, so a rerun with a different `--now` alone is never reported as a
content change by `diff`.

### Data notes

- Basis is per 100 g edible portion, except Level-1 `"Bebidas alcoólicas"`
  rows, which are per 100 ml.
- A blank nutrient cell is `MISSING` and is **omitted** from canonical
  output -- never inferred as `0`. The real export represents almost all
  blanks as empty strings rather than `None`; both are treated as `MISSING`.
- The 48 data columns (`F`..`BA`) are mapped by curated position, not label
  matching, in `nutrient_map.py` -- the adapter's single source of truth for
  INFOODS/EUROFIR codes, canonical codes/units, and confidence
  (`"high"` iff unit is `g`/`kcal`/`kJ`, else `"medium"`).
- The workbook is only ever opened read-only and is never modified.

### Tests

```bash
cd services/food-ingestion
python -m pytest -q
```

Tests run against a minimal synthetic workbook
(`tests/fixtures/mini_insa.xlsx`, generated by
`tests/fixtures/make_mini_insa.py`) -- the real, licensed INSA workbook is
never used as a test fixture and is not redistributed from this package.
