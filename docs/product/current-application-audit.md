# Current Application Audit Baseline

## Public identity
- Google Play title: Eat with T1D
- Package ID: `eu.asasnospes.comercomdt1`
- Developer: Asas nos pés
- Public listing: https://play.google.com/store/apps/details?id=eu.asasnospes.comercomdt1&hl=en-US&pli=1
- Public listing reviewed: 2026-07-13
- Listing update date: 2026-06-06
- Public install band: 10K+

## Capabilities explicitly stated in the listing
- Ten nutritional tables.
- Carbohydrate, calorie, fat, and protein counting.
- Automatic FPU conversion.
- Custom food creation.
- Meal history.
- Carbohydrate calculator for home cooking.
- Nightscout nutrient submission.
- Favourites.
- Enable or disable food lists in search.
- Create custom foods from existing foods.
- FPU deviation adjustment in the current meal.

## Public data-safety statements requiring investigation
The Google Play listing states that the app may share personal information and device or other identifiers, may collect device identifiers, encrypts data in transit, and does not provide deletion. These declarations must be reconciled with the actual code, SDK inventory, backend behaviour, privacy policy, and other store disclosures before migration.

## Evidence still required
- Source repository and build instructions.
- Production data model and migration format.
- Complete list of food tables, versions, licences, and transformations.
- Current iOS listing and feature differences.
- Screenshots mapped to functional journeys.
- Analytics, crash reporting, advertising, support, and purchase SDK inventory.
- Nightscout API version and credential storage.
- Backup and sharing file formats.
- Custom foods, favourites, recipe, history, and settings export capability.
- Accessibility and localisation behaviour.
- Active users, country distribution, retention, failure reports, and support themes.

## Audit method
1. Capture the store listing and disclosures as dated evidence.
2. Test the production build with synthetic data only.
3. Inspect source and dependency inventory.
4. Trace each public capability to code, data, storage, integrations, and migration.
5. Classify each capability as retain, redesign, replace, defer, or remove.
6. Do not declare parity from the store description alone.
