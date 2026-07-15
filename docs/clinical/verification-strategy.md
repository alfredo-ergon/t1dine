# Clinical Verification Strategy

- Requirement-based unit tests for every calculation and stop condition.
- Boundary tests around units, freshness, thresholds, maximums, increments, and zero/negative values.
- Property tests for monotonic and invariance expectations where clinically approved.
- Golden vectors independently authored and reviewed.
- Traceability from intended-use requirement to hazard, control, implementation, and test.
- Independent code and test review.
- Usability validation for entry, comprehension, warning response, and confirmation.
- Algorithm-version migration and historical replay tests.
- No production release based only on automated tests.
