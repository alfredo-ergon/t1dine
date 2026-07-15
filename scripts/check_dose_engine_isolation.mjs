// Guards that the deterministic dose engine never gains a runtime dependency.
// Complements the dependency-cruiser import-graph rules (which catch imports)
// by catching a declared dependency in package.json. Stdlib-only, no installs.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pkgPath = fileURLToPath(new URL("../packages/dose-engine/package.json", import.meta.url));
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

const runtimeDeps = Object.keys(pkg.dependencies ?? {});
if (runtimeDeps.length > 0) {
  console.error(
    `Dose engine must declare no runtime dependencies (ADR-0003). Found: ${runtimeDeps.join(", ")}`,
  );
  process.exit(1);
}

console.log("dose-engine runtime-dependency guard: OK (no runtime dependencies).");
