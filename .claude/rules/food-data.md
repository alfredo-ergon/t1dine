---
paths:
  - "services/food-ingestion/**"
  - "packages/food-schema/**"
  - "docs/data/**"
---
# Food Data Rules
- Preserve the raw source record and immutable source snapshot.
- Every transformation must be versioned and explainable.
- Record nutrient basis, units, preparation state, market, and source date.
- Never silently average conflicting nutrient values.
- AI extraction creates a candidate record, never an automatically trusted canonical record.
