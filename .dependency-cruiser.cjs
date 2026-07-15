// Import-graph guardrails that enforce the dose-engine isolation rule
// (ADR-0003 / .claude/rules/architecture.md) on the *resolved* dependency
// graph — far stronger than a text grep. Run via `pnpm boundaries`.
//
// Two directions are enforced:
//   1. The dose engine may import only Node stdlib and its own files.
//   2. Nothing may import the dose engine except one designated boundary module.
module.exports = {
  forbidden: [
    {
      name: "dose-engine-no-external-imports",
      comment:
        "packages/dose-engine must depend only on the Node standard library and its own files " +
        "(no AI, network, HTTP, persistence, analytics, or other workspace packages).",
      severity: "error",
      // Scope to the SHIPPED source only. The engine's own dev tests
      // (packages/dose-engine/test) legitimately import vitest and the engine.
      from: { path: "^packages/dose-engine/src" },
      to: {
        pathNot: "^packages/dose-engine",
        dependencyTypesNot: ["core"],
      },
    },
    {
      name: "only-boundary-imports-dose-engine",
      comment:
        "The deterministic dose engine may only be imported through the approved boundary " +
        "module (services/api/src/dose-boundary). No app/service/package may import it directly.",
      severity: "error",
      from: {
        pathNot: "^(packages/dose-engine|services/api/src/dose-boundary|apps/mobile/src/dose/boundary)",
      },
      to: {
        path: "packages/dose-engine|@t1dine/dose-engine",
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: [".ts", ".js", ".json"],
    },
  },
};
