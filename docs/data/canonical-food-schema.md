# Canonical Food Schema

## Identity
- canonical_food_id
- source_id and source_record_id
- food_type: ingredient, packaged, restaurant, recipe, custom
- brand, barcode, restaurant, retailer
- country, market, region
- names, synonyms, language, transliteration

## Physical and preparation state
- raw, cooked, drained, frozen, dried, reconstituted
- preparation method
- density and edible portion where applicable
- serving options with grams or millilitres

## Nutrient values
Every nutrient observation contains:
- nutrient code and display name;
- numeric value;
- unit;
- basis quantity and basis unit;
- available carbohydrate definition;
- analytical, declared, calculated, or estimated method;
- source version and effective date;
- transformation lineage;
- confidence and validation status.

Core nutrients:
- carbohydrate;
- fibre;
- sugars and sugar alcohols when available;
- protein;
- fat;
- energy;
- optional micronutrients without blocking the core meal journey.

## Classification
- cuisine tags;
- dietary-pattern tags;
- allergen tags;
- meal-context tags;
- clinical-behaviour tags;
- search facets.

## Provenance and lifecycle
- licence and attribution;
- retrieved_at and source_effective_at;
- raw snapshot URI and checksum;
- mapping version;
- reviewer and approval status;
- superseded_by and retired_at.
