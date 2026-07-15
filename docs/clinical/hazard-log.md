# Initial Hazard Log

| ID | Hazard | Example cause | Initial control |
|---|---|---|---|
| H-001 | Excess estimate | Wrong carbohydrate or unit | Confirmation, plausibility, provenance |
| H-002 | Excess correction | Stale glucose or wrong target | Freshness gate, profile version |
| H-003 | Stacking | Missing active insulin | Mandatory IOB state, duplicate-dose protection |
| H-004 | Wrong unit | mg/dL and mmol/L confusion | Explicit unit, visible conversion, tests |
| H-005 | Wrong profile segment | Time-zone or schedule error | Versioned local-time profile and DST tests |
| H-006 | AI contamination | Photo estimate treated as certain | User confirmation and AI separation |
| H-007 | Duplicate action | Repeated submission or sync retry | Idempotency key and recent-event warning |
| H-008 | Child misuse | Unsupervised dependent profile | Guardian controls and intended-population decision |
| H-009 | Hidden rounding | Device increment mismatch | Explicit increment and displayed arithmetic |
| H-010 | Data leak | Health values in telemetry | Redaction, synthetic tests, telemetry review |
| H-011 | Dosing while hypoglycaemic | Correction/meal dose issued when glucose is low | Hypoglycaemia guard: engine fails closed at or below the configured threshold and instructs to treat the low first (v0.2, unit-tested) |

## Control implementation status (engine v0.2 — unreleased)
Implemented and unit-tested in `packages/dose-engine` (see `packages/dose-engine/test/dose-engine.test.ts`):
- H-001: carbohydrate plausibility bound; full displayed arithmetic in the review UI.
- H-002: freshness — future-dated glucose blocks; glucose validated against a plausible band.
- H-003: active insulin is mandatory and never silently zeroed (null fails closed).
- H-004: explicit glucose unit with per-unit plausible/target bands (no silent conversion).
- H-009: pen increment is explicit and the arithmetic is displayed; maximum is re-asserted AFTER rounding.
- H-011: hypoglycaemia guard (new).

Still requiring clinical, human-factors, quality, and regulatory ownership: H-005 (time-segment profiles), H-006/H-007/H-008/H-010, glucose trend handling, freshness/staleness windows, independent golden-vector verification, and the release gate before any dose value is shown outside controlled testing. This log remains incomplete.
