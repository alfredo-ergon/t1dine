import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Separate config so `pnpm demo` runs the examples without polluting the
// unit/contract test suite (`pnpm test`).
export default defineConfig({
  resolve: {
    alias: {
      "@t1dine/domain": fileURLToPath(new URL("./packages/domain/src/index.ts", import.meta.url)),
      "@t1dine/food-schema": fileURLToPath(new URL("./packages/food-schema/src/index.ts", import.meta.url)),
    },
  },
  test: {
    include: ["examples/**/*.ts"],
    environment: "node",
  },
});
