# T1Dine Platform Bootstrap

T1Dine is the working product name for a global, offline-first food and meal application for people living with Type 1 diabetes and their caregivers.

This repository is a Claude Code bootstrap, architecture baseline, safety boundary, and delivery scaffold. It is not a clinically released medical device and must not be presented as one.

## Product split

1. **T1Dine Core**
   - Food search, barcode scanning, recipes, saved meals, nutrition totals, history, favourites, localisation, caregiver profiles, and integrations.
   - AI can assist with food discovery, label extraction, translation, and uncertain meal estimation.

2. **T1Dine Dose Assist**
   - A separately governed deterministic calculation module.
   - No generative AI, image model, or probabilistic model is allowed in its calculation path.
   - It must not ship until intended use, clinical ownership, risk classification, verification, usability, regulatory, and post-market obligations are resolved.

## Reference stack

- Mobile: React Native with Expo and TypeScript
- Admin portal: Next.js and TypeScript
- Backend API: TypeScript service on Azure Container Apps
- Food ingestion: Python workers and scheduled jobs
- Primary data store: Azure Database for PostgreSQL
- Search: Azure AI Search
- Files and source snapshots: Azure Blob Storage
- Messaging: Azure Service Bus
- Identity: Microsoft Entra External ID
- Secrets: Azure Key Vault
- Edge and API governance: Azure Front Door and API Management
- Observability: OpenTelemetry and Application Insights with health-data redaction
- Infrastructure: Bicep and Azure Developer CLI

FHIR is deliberately deferred. Introducing a FHIR platform before there is an actual clinical interoperability requirement adds cost and complexity without improving the core meal experience.

## Repository map

- `.claude/`: Claude Code rules, agents, skills, settings, and safety hooks
- `prompts/`: initial Plan-mode prompt and subsequent execution prompts
- `docs/`: product, architecture, food data, clinical safety, security, UX, delivery, and knowledge
- `apps/`: mobile and admin application boundaries
- `services/`: API, food ingestion, search indexing, and integration services
- `packages/`: shared domain contracts, food schema, and isolated dose engine
- `infra/`: Azure infrastructure and environment boundaries
- `scripts/`: repository validation and setup helpers

## Start here

1. Install Claude Code, Node.js 20 or later, pnpm, Python 3.12 or later, Azure CLI, Docker, and Git.
2. Copy `.env.example` to `.env.local` and populate only the variables you actually use.
3. Authenticate with `az login` and GitHub as appropriate.
4. Review `.mcp.json`. Disable MCP servers you do not use.
5. Run `python scripts/validate_repo.py`.
6. Start Claude Code in Plan mode:

```bash
claude --permission-mode plan
```

7. Paste the content of `prompts/00-initial-plan-mode.md`.

## Non-negotiable rules

- Never store secrets, glucose values, insulin settings, or dose outputs in logs, analytics, crash telemetry, prompts, or test fixtures.
- Every food nutrient value must retain source, market, version, licence, and confidence.
- AI output is always untrusted until confirmed by the user.
- The dose engine is deterministic, versioned, independently testable, and isolated from AI.
- Do not call a dose output a recommendation until the regulatory and clinical pathway explicitly permits that intended use.
- No production deployment from Claude Code without explicit human approval.

## Working name

`T1Dine` is provisional. Complete trademark, company-name, app-store, social-handle, and domain clearance before brand commitment.
