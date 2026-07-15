import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Minimal, fast (non type-checked) lint pass over the workspace TypeScript.
// packages/dose-engine is intentionally excluded: it is governed by clinical
// change-control + the dependency-cruiser isolation guard, and style lint must
// never be able to force an edit to the deterministic clinical code.
export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "packages/dose-engine/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
