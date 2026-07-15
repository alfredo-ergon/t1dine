# T1Dine Claude Code Instructions

## Mission
Build a global, trustworthy, offline-first food and meal platform for people living with Type 1 diabetes and caregivers. Preserve useful capabilities from the existing Comer com DT1 application while replacing its fragmented user experience and Portugal-heavy data model.

## Product boundaries
- T1Dine Core handles foods, recipes, meals, history, integrations, localisation, and caregiver workflows.
- T1Dine Dose Assist is a separate deterministic module with separate governance and release criteria.
- Never put AI, OCR, image recognition, or probabilistic inference inside the dose calculation path.
- Never present unreleased functionality as medical advice or a clinically validated recommendation.

## Required reading before planning or coding
1. `docs/product/product-vision.md`
2. `docs/product/current-application-audit.md`
3. `docs/product/feature-parity.md`
4. `docs/architecture/target-architecture.md`
5. `docs/data/food-data-strategy.md`
6. `docs/data/canonical-food-schema.md`
7. `docs/clinical/intended-use-and-boundary.md`
8. `docs/clinical/safety-requirements.md`
9. `docs/security/privacy-and-data-classification.md`
10. `docs/delivery/roadmap-and-epics.md`

## Engineering standards
- TypeScript strict mode for mobile, web, APIs, and shared packages.
- Python type checking for ingestion workers.
- Keep domain logic framework-independent.
- All external data is untrusted. Validate at boundaries.
- Use idempotent ingestion and immutable source snapshots.
- Prefer explicit types and pure functions over hidden framework behaviour.
- Add tests before changing clinical or nutrient-normalisation logic.
- No network calls from `packages/dose-engine`.
- No imports from AI, analytics, UI, HTTP, or persistence packages into `packages/dose-engine`.

## Data rules
- Store nutrients against a declared basis, normally per 100 g or per 100 ml.
- Preserve original source values and transformation history.
- Never merge conflicting food values by silently averaging them.
- Country, market, language, cuisine, dietary pattern, food form, preparation, and clinical-behaviour tags are separate dimensions.
- User-created and AI-estimated foods must display uncertainty and provenance.

## Privacy and security
- Deny access to `.env*`, credentials, private keys, tokens, and production exports.
- Do not place health data in telemetry.
- Use synthetic fixtures only.
- Use least privilege for MCPs, cloud identities, and CI credentials.
- Treat Nightscout tokens as high-impact credentials.

## Delivery behaviour
- Start non-trivial work in Plan mode.
- Identify assumptions and unresolved product decisions before implementation.
- Break work into small vertical slices with acceptance criteria.
- Use ADRs for architecture decisions.
- Maintain traceability from requirement to code, tests, and evidence.
- Do not deploy production resources or push branches without explicit approval.

## Definition of done
A change is not done until implementation, tests, documentation, threat impact, privacy impact, accessibility impact, telemetry impact, and rollback implications are addressed.
