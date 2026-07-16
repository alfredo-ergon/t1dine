# INSA / PortFIR — food composition data attribution

The Portuguese food records with ids prefixed `pt-insa-` are derived from the
**Base de Dados da Composição de Alimentos (BDCA)** published by the
**Instituto Nacional de Saúde Doutor Ricardo Jorge (INSA)** via PortFIR.

## Required attribution (must remain visible wherever the data is shown)

> **Fonte:** Base de Dados da Composição de Alimentos. Instituto Nacional de
> Saúde Doutor Ricardo Jorge, I. P. — INSA. v 7.1 - 2026.

- Source portal: https://portfir.insa.min-saude.pt/
- Contact: tabela.alimentos@insa.min-saude.pt
- Dataset version ingested: **BDCA v7.1 (2026)** (workbook updated 2026-03-03)

INSA's terms (accepted on download): the data may be used provided the source is
cited **visibly** wherever the table's data is inserted. In T1Dine this
attribution is surfaced on each food's detail screen via its provenance
(`source.sourceId` = `INSA-BDCA`, `sourceVersion` = `BDCA v7.1 (2026)`,
`source.attribution` = the string above), and here. Commercial-scale reuse and
raw-dataset redistribution are not addressed by the terms — see the open
questions in [`portfir-source-governance.md`](portfir-source-governance.md).

## What is / isn't committed

- **Committed:** the *derived* per-basis values for **all 48 mapped nutrients**
  (available carbohydrate `CHOAVL`, energy `ENERC`/`ENERC_KJ`, fibre `FIBTG`,
  sugars, protein, fats, salt/sodium, vitamins, minerals, …), plus the food code,
  name, 3-level food group, and preparation state, mapped to `CanonicalFood` in
  [`services/api/src/catalogData/portugalInsa.ts`](../../services/api/src/catalogData/portugalInsa.ts)
  via [`insaBuilder.ts`](../../services/api/src/catalogData/insaBuilder.ts). Values
  are per 100 g edible, or per 100 ml for alcoholic beverages.
- **Not committed:** the raw INSA workbook (`docs/data/insa_tca.xlsx`) is
  git-ignored and never redistributed. Its SHA-256 is recorded in
  `insaBuilder.ts` and `portfir-source-governance.md`.

## Provenance & method

INSA values are analytically determined, so each observation is recorded with
`method: "analytical"`; confidence is unit-derived (macronutrients `high`,
micronutrients `medium`). **Missing** values are preserved as missing (the
observation is omitted) — never coerced to zero. The source has no trace /
below-detection tokens, so trace and true zero are indistinguishable in the data.
English names currently mirror the Portuguese name (INSA is PT-only); a proper EN
localisation is a separate, tracked task — not silently invented.

## Regeneration

`portugalInsa.ts` is generated deterministically from the local workbook by the
ingestion adapter (`services/food-ingestion`, e.g.
`python -m food_ingestion.portfir.emit_catalog --input docs/data/insa_tca.xlsx`),
which replaced the earlier throwaway scratchpad script. Regenerate when a new
BDCA version is obtained, bumping `INSA_SOURCE_VERSION`/`INSA_SNAPSHOT_SHA256` in
`insaBuilder.ts`.
