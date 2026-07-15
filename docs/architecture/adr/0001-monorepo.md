# ADR 0001: TypeScript and Python Monorepo

Status: Accepted (realised in Slice 1)

Use a pnpm monorepo for mobile, admin, API, and shared TypeScript packages. Keep Python ingestion workers in the same repository with independent packaging. This supports shared contracts while preserving language fitness for data processing.

Slice 1 makes this concrete: the workspace now builds and installs, cross-package contracts resolve (`@t1dine/food-schema` depends on `@t1dine/domain`), and a single CI pipeline runs typecheck, lint, tests, the dose-engine isolation guard, and repository validation.
