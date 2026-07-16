import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Internal workspace packages are consumed as TypeScript source (no build step),
// so map the package names to their entry points for the test runner.
export default defineConfig({
  resolve: {
    alias: {
      "@t1dine/domain": fileURLToPath(new URL("./packages/domain/src/index.ts", import.meta.url)),
      "@t1dine/food-schema/fixtures": fileURLToPath(new URL("./packages/food-schema/src/fixtures/index.ts", import.meta.url)),
      "@t1dine/food-schema": fileURLToPath(new URL("./packages/food-schema/src/index.ts", import.meta.url)),
      "@t1dine/nutrition": fileURLToPath(new URL("./packages/nutrition/src/index.ts", import.meta.url)),
      "@t1dine/design-tokens": fileURLToPath(new URL("./packages/design-tokens/src/index.ts", import.meta.url)),
      "@t1dine/dose-engine": fileURLToPath(new URL("./packages/dose-engine/src/index.ts", import.meta.url)),
    },
  },
  test: {
    include: ["packages/**/test/**/*.test.ts", "services/**/test/**/*.test.ts", "apps/**/test/**/*.test.ts"],
    environment: "node",
  },
});
