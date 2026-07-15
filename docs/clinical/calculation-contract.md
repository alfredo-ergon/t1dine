# Deterministic Calculation Contract

This document defines a candidate engineering contract, not a released medical instruction.

## Explicit inputs
- confirmed carbohydrate grams;
- current glucose value and unit;
- glucose measurement timestamp and source;
- target glucose;
- insulin-to-carbohydrate ratio;
- correction factor;
- active insulin value and source state;
- profile version and applicable time segment;
- administration increment;
- configured maximum estimate;
- user acknowledgement of missing contextual factors.

## Candidate arithmetic (engine v0.2, unreleased)
- meal component = carbohydrate grams / grams covered by one unit (e.g. HC ÷ 50);
- correction component = (current glucose - target glucose) / correction factor (e.g. (glicemia - 100) ÷ 50);
- subtotal = meal component + correction component - active insulin;
- output = safety-gated, then rounded to the pen increment (round-to-nearest; 0.5 or 1 unit), with the maximum re-asserted AFTER rounding.

## Fail-closed conditions (return a blocked status with an explicit reason, never a number)
- glucose at or below the configured hypoglycaemia threshold — treat the low first;
- glucose or target outside the plausible band for the declared unit;
- implausible carbohydrate amount;
- active insulin unknown/invalid; missing profile version; invalid or future-dated timestamps;
- computed value not finite, below zero, or above the configured maximum after rounding.

## Configurability
The ratio, correction factor, target, unit, pen increment, maximum, and hypoglycaemia threshold are set per user profile (New Profile). Changing any of them bumps the profile version recorded in the calculation audit record. The two "50s" (50 g carb ratio vs 50 mg/dL correction factor) are independent parameters and must never be conflated.

## Prohibitions
- no inferred profile parameters;
- no silent substitution of missing active insulin with zero;
- no AI adjustment;
- no hidden trend adjustment;
- no silent unit conversion without visible confirmation;
- no imperative “take” instruction in an unapproved product.
