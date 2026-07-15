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
(`source.sourceId` = `INSA-BDCA`, `sourceVersion` = `BDCA v7.1 (2026)`), and here.

## What is / isn't committed

- **Committed:** only the *derived* per-100 g values we use (available
  carbohydrate `CHOAVL` and energy `ENERC`), plus the food code and name, mapped
  to `CanonicalFood` in [`services/api/src/catalogData/portugalInsa.ts`](../../services/api/src/catalogData/portugalInsa.ts)
  via [`insaBuilder.ts`](../../services/api/src/catalogData/insaBuilder.ts).
- **Not committed:** the raw INSA workbook (`docs/data/insa_tca.xlsx`) is
  git-ignored and never redistributed.

## Provenance & method

INSA values are analytically determined, so each observation is recorded with
`method: "analytical"` and `confidence: "high"`. English names currently mirror
the Portuguese name (INSA is PT-only); a proper EN localisation is a separate,
tracked task — not silently invented.

## Regeneration

`portugalInsa.ts` is generated from the local workbook by
`scratchpad/gen_insa.py` (reads only the derived columns). Regenerate when a new
BDCA version is obtained, bumping `INSA_SOURCE_VERSION` in `insaBuilder.ts`.
