# Existing Application Feature-Parity Baseline

This is a starting inventory to validate against source code, store listings, current production behaviour, and owner interviews.

| Capability | Target decision | Notes |
|---|---|---|
| Food search | Redesign and retain | One search across authoritative, branded, restaurant, custom, and saved items |
| Browse food lists | Retain as filters/collections | Do not expose raw source-table structure as the main UX |
| Nutrient totals | Retain | Carbohydrate, protein, fat, fibre, energy, optional FPU |
| Current meal | Redesign and retain | Central user journey |
| Recipe calculator | Redesign and retain | Guided ingredients, cooked yield, reusable portions |
| Favourites | Retain | Include recent, frequent, pinned, and household favourites |
| Custom foods | Retain and migrate | Require provenance and user ownership |
| History | Retain | Privacy controls, export, deletion, reuse |
| Restaurant lists | Retain and globalise | Country-specific versions and dates |
| Supermarket products | Expand | Barcode, Open Food Facts, manufacturer feeds, local sources |
| Multiple languages | Expand | Local names, synonyms, units, right-to-left readiness |
| Nightscout integration | Retain with safer onboarding | Token vaulting, scoped access, explicit sync actions |
| Backup and sharing | Replace with account sync plus export | Keep local export and user-controlled sharing |
| FPU calculation | Retain as optional research-informed feature | Do not silently alter insulin calculations |
| Insulin estimate | New, separate workstream | Regulated boundary and explicit release gate |

## Mandatory validation
Do not claim parity until the team has access to the existing source, datasets, production build, privacy disclosures, and representative user workflows.
