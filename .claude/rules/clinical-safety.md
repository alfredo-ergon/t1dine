---
paths:
  - "packages/dose-engine/**"
  - "docs/clinical/**"
  - "apps/mobile/**/dose*"
---
# Clinical Safety Rules
- A dose calculation is deterministic and reproducible from explicit inputs.
- Never infer insulin settings from behaviour, history, photos, text, or AI.
- Require explicit units, timestamps, profile version, and insulin-on-board state.
- Fail closed on missing, stale, contradictory, or out-of-range inputs.
- Return a calculation record and safety status, not an imperative instruction.
- Any formula or rounding change requires tests, hazard review, traceability, and versioning.
