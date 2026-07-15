# Target Architecture

## Deliberate starting point
Use a modular monolith for the transactional backend and separate only the workloads with materially different runtime or safety characteristics:
- food ingestion workers;
- search indexing;
- deterministic dose-engine package;
- mobile application;
- admin portal.

Starting with many microservices would slow delivery, increase operational burden, and create false sophistication.

## Components

### Mobile
React Native with Expo, TypeScript, encrypted local persistence, offline queue, background sync, barcode scanning, camera-assisted label capture, localisation, accessibility, and secure token storage.

### Admin portal
Next.js portal for source registration, ingestion review, conflict resolution, translations, taxonomy, restaurant versions, quality dashboards, and audit history.

### Core API
A TypeScript modular monolith hosted on Azure Container Apps. Modules: identity/profile, food catalogue, meals/recipes, custom foods, sync, integrations, export/deletion, and audit.

### Ingestion
Python workers retrieve or import immutable source snapshots, validate source contracts, normalise nutrients, create candidate records, and publish approved changes.

### Search
Azure AI Search holds denormalised searchable documents with language, market, source, confidence, barcode, cuisine, dietary, preparation, and meal-context fields.

### Data
PostgreSQL is the system of record. Blob Storage retains raw source snapshots, evidence, import reports, and export bundles. Service Bus decouples ingestion and indexing jobs.

### Identity and secrets
Microsoft Entra External ID for consumer identities. Key Vault for service secrets. Managed identities for Azure workloads.

### API edge
Front Door and WAF at the public edge. API Management for versioning, quotas, policy, and integration governance when justified by deployment maturity.

### Observability
OpenTelemetry into Application Insights. Health data is filtered before export. Operational correlation identifiers must not encode user or clinical values.

### FHIR
Defer Azure Health Data Services until a concrete EHR, clinician, payer, or medical-device interoperability requirement exists. Create an adapter boundary now, not a platform dependency.
