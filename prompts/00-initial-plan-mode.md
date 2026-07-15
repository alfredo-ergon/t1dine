You are starting the T1Dine platform in Claude Code Plan mode. Do not edit files, run write operations, create cloud resources, create work items, or change external systems during this session.

First, read `CLAUDE.md` and the required documents it references. Then inspect the complete repository tree, `.mcp.json`, `.claude/settings.json`, agents, skills, existing package boundaries, and validation script.

Use focused subagents for product architecture, food data, clinical safety, security/privacy, mobile UX, backend architecture, and quality/regulatory review. Return only their consolidated findings, not raw research dumps.

Project objective:
Build a materially better successor to the current Comer com DT1 application while preserving all valuable current capabilities. The new product must support a worldwide food database, multidimensional food segmentation, rapid meal construction, recipes, favourites, history, barcode and label workflows, localisation, caregiver profiles, Nightscout integration, and an easy flow that starts with “What am I eating?”

The product has two boundaries:
1. T1Dine Core, the food and meal platform.
2. T1Dine Dose Assist, an isolated deterministic calculation module that must not use AI and must not be released as a clinical recommendation until the intended use, clinical ownership, verification, regulatory pathway, and post-market obligations are resolved.

Produce a decision-ready implementation plan containing:

1. Repository assessment
   - What is present, missing, inconsistent, or over-engineered.
   - Whether the proposed stack is appropriate for a small initial team and global growth.

2. Asset and ownership gate
   - Source code, app-store accounts, brand rights, domains, food datasets, licences, analytics, user migration, and privacy obligations required from the existing application.
   - Explicitly distinguish an authorised upgrade from a clean-room replacement.

3. Current capability parity matrix
   - Map every known Comer com DT1 capability to retain, redesign, replace, defer, or remove.
   - Identify migration implications for custom foods, favourites, recipes, meals, and Nightscout settings.

4. Product and UX plan
   - Primary journeys for first-run profile, search, barcode, photo/label assistance, recipe creation, meal assembly, history, caregiver use, offline use, and calculation review.
   - Accessibility, language, units, uncertainty, and error states.

5. Worldwide food-data plan
   - Canonical schema, source hierarchy, country and market handling, cuisine and dietary segmentation, provenance, confidence, licensing, conflict resolution, update cadence, admin curation, and search indexing.
   - Initial launch geographies and a rational sequencing strategy. Do not claim “worldwide” by merely connecting Open Food Facts.

6. Architecture plan
   - Mobile, admin, API, ingestion, search, storage, identity, sync, observability, security, integrations, infrastructure, and environments.
   - Identify what should remain a modular monolith initially and what genuinely needs an independent service.
   - Explain why FHIR is deferred or justify it with a concrete requirement.

7. Dose Assist safety plan
   - Intended-use questions, calculation inputs, units, profile versioning, active insulin, freshness, trend handling, rounding, maximums, failure modes, audit record, hazards, verification, and release gates.
   - No implementation plan may allow generative AI to determine, alter, or silently validate a dose.

8. Privacy and security plan
   - Health-data classification, consent, deletion, export, retention, child/caregiver controls, Nightscout token handling, analytics redaction, threat model, and incident response.

9. Delivery plan
   - Prioritised epics and vertical slices for discovery, foundation, MVP, beta, and regulated Dose Assist workstream.
   - Give each slice acceptance criteria, dependencies, evidence, and a rollback point.
   - Provide a realistic first 12-week plan for a small team. Do not pretend the regulated module can be production-ready in that period.

10. Decision log
    - Decisions that can be made now.
    - Decisions requiring the owner, clinician, regulatory specialist, designer, or existing-app maintainer.
    - Top ten risks ranked by impact and likelihood.

11. Recommended first execution prompt
    - After the plan is approved, provide the exact next Claude Code prompt for the first vertical slice only.

Be direct. Challenge unnecessary services, premature AI, and vague “worldwide” claims. State assumptions explicitly. Do not exit Plan mode until the user approves the plan.
