# Dose Assist Safety Requirements

The engine must fail closed when:
- glucose unit is absent or unsupported;
- glucose value is stale or future-dated;
- carbohydrate amount is absent, negative, or implausible;
- ratio, correction factor, target, active insulin, increment, or profile version is missing;
- active insulin state is unknown where required;
- profile is expired or not approved for the current time segment;
- input sources disagree materially;
- result is negative, non-finite, or above the configured maximum;
- hypoglycaemia protection or another configured stop condition is triggered.

Every result record must contain:
- exact inputs and units;
- timestamps and source identities;
- profile and algorithm versions;
- unrounded components;
- rounding rule and rounded value;
- safety status, warnings, and stop reasons;
- user confirmation event;
- no directly identifying information in exported technical logs.
