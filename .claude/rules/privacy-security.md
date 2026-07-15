---
paths:
  - "apps/**"
  - "services/**"
  - "infra/**"
---
# Privacy and Security Rules
- Use synthetic health and identity data in all development assets.
- Redact health data before logs, traces, metrics, crash reports, and support exports.
- Store access tokens only in approved secret stores.
- Apply least privilege and separate development, test, staging, and production identities.
- Threat-model new integrations before implementation.
