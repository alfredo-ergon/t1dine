---
paths:
  - "apps/**"
  - "services/**"
  - "packages/**"
  - "infra/**"
---
# Architecture Rules
- Keep application shells thin and domain packages framework-independent.
- Use ports and adapters around databases, search, identity, telemetry, and external food sources.
- No service may import mobile or admin UI code.
- The dose engine imports only standard-library or deterministic local domain contracts.
- Record material decisions as ADRs before introducing another database, queue, AI model, or cloud service.
