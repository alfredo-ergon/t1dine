---
paths:
  - "apps/**"
  - "services/**"
  - "packages/**"
---
# Testing Rules
- Add unit tests for domain logic and contract tests for external adapters.
- Food normalisation requires golden fixtures with source metadata.
- Clinical logic requires boundary, property, traceability, and regression tests.
- E2E tests use synthetic users and synthetic health values only.
- Do not approve snapshot changes without reviewing semantic impact.
