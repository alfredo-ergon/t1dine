# Worldwide Food Data Strategy

“Worldwide” is not a connector. It is an operating model for source coverage, localisation, licensing, curation, quality, and updates.

## Source hierarchy
1. National and regional composition databases for ingredients and common prepared foods.
2. Manufacturer and official retailer data for packaged products.
3. Official restaurant nutrition data, versioned by country and publication date.
4. Open Food Facts and other community sources, visibly quality-scored.
5. User-created foods and recipes, private by default.
6. AI or OCR-derived candidates, always requiring confirmation.

## Launch sequencing
Do not launch with thin global coverage. Select initial markets based on existing user base, available authoritative data, language support, licensing, and operational ability to maintain records. A rational initial sequence is Portugal, Spain, United Kingdom, selected EU markets, Brazil, and United States, subject to validation.

## Segmentation dimensions
- country, region, and market;
- language and local synonyms;
- cuisine and eating pattern;
- ingredient, packaged item, restaurant item, recipe, or custom food;
- raw/cooked state and preparation method;
- meal context;
- allergen and dietary attributes;
- clinical-behaviour tags such as rapid carbohydrate, liquid carbohydrate, mixed meal, high fat/protein, fibre-rich, delayed absorption, or uncertain estimate;
- source authority and confidence.

A food can belong to several cuisines and patterns. Do not model “Mediterranean” as a separate database.

## Governance
- Each source has an owner, licence, territory, cadence, mapping version, quality score, and retirement plan.
- Raw source snapshots are immutable.
- Candidate promotion is auditable.
- Source removal must not destroy historical meal evidence.
