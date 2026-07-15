# Deterministic Dose Engine Boundary

This package is an engineering boundary, not a clinically released feature.

Rules:
- no network;
- no AI;
- no analytics;
- no persistence;
- no UI;
- no hidden defaults;
- explicit units and timestamps;
- deterministic versioned output;
- fail closed when required information is unknown.

Set `T1DINE_CLINICAL_EDIT=1` only for an explicitly approved change session.
