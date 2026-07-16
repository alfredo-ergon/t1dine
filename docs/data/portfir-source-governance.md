# PortFIR / INSA — Source Governance Record

Machine-readable governance for the INSA BDCA food-composition source. See also
`docs/data/insa_attribution.md` (attribution copy) and
`docs/architecture/adr/0008-portfir-source-onboarding.md` (decision).

```yaml
source_id: INSA-BDCA
source_owner: Instituto Nacional de Saúde Doutor Ricardo Jorge, I. P. (INSA)
programme: PortFIR
dataset_name: Base de Dados da Composição de Alimentos (BDCA)
dataset_version: "7.1-2026"
dataset_updated: "2026-03-03"
source_url: https://portfir.insa.min-saude.pt/
contact: tabela.alimentos@insa.min-saude.pt
market: PT
language: pt-PT

raw_file:
  # The raw workbook is NEVER committed or redistributed (see .gitignore).
  path_local: docs/data/insa_tca.xlsx
  sha256: bc51a2c136801b83c2f2566d303accb679b1ad679ee09f80cc7fb751074465eb
  size_bytes: 414480
  committed: false

licence:
  # The workbook's "Informação adicional" sheet: use is permitted provided the
  # source is cited visibly wherever the table's data appears.
  copyright_asserted: true
  attribution_required: true
  attribution_text: >-
    Fonte: Base de Dados da Composição de Alimentos. Instituto Nacional de Saúde
    Doutor Ricardo Jorge, I. P.- INSA. v 7.1 - 2026.
  use_in_app: GRANTED  # explicit in the terms, conditional on visible attribution
  raw_redistribution: NOT_ADDRESSED
  commercial_use: NOT_ADDRESSED
  modification_derived_works: NOT_ADDRESSED

review:
  status: APPROVED_FOR_USE_WITH_ATTRIBUTION
  scope: Derived per-basis values only; raw workbook not redistributed.
  approval_owner: food-data
  approval_date: "2026-07-16"
  open_questions:
    - Is commercial-scale use of derived values permitted at product scale?
    - Are raw-dataset redistribution rights obtainable if ever needed?
  # These open questions DO NOT block use-with-attribution of derived values,
  # but MUST be resolved before any raw-dataset redistribution.

publication:
  derived_values_published: true       # 1,376 foods seeded approved
  raw_dataset_published: false
  attribution_surfaced_in_ui: true     # via source.sourceId / attribution on food detail
```
