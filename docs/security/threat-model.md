# Initial Threat Model

## Assets
Health data, identity, caregiver relationships, food-source integrity, clinical settings, dose records, source licences, Nightscout tokens, signing keys, app-store accounts, and production infrastructure.

## Trust boundaries
Mobile device, local storage, public API edge, identity provider, backend, database, search, ingestion workers, third-party food sources, AI services, Nightscout, admin portal, MCP servers, CI/CD, and support tooling.

## Priority threats
- credential theft and token reuse;
- malicious or incorrect food-source data;
- prompt injection through web pages, source text, issues, or MCP output;
- health data in logs or analytics;
- overprivileged caregiver or admin access;
- sync conflict causing wrong meal or profile data;
- supply-chain compromise;
- environment crossover;
- replay or duplicate calculation events;
- unauthorised production deployment.

## Baseline controls
Least privilege, managed identity, secret vaulting, signed builds, dependency scanning, immutable source snapshots, approval workflows, synthetic test data, telemetry redaction, audit history, idempotency, environment separation, and incident playbooks.
