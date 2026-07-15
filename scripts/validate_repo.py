#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []

# Directories that are not part of the tracked repository and must not be
# scanned: installed dependencies, build output, and tool caches. Third-party
# packages ship JSON5-style tsconfig.json files that strict json.loads rejects,
# so scanning node_modules produced false failures once dependencies existed.
IGNORE_DIRS = {
    "node_modules",
    ".git",
    "dist",
    "build",
    "coverage",
    ".pnpm-store",
    ".venv",
    "__pycache__",
    ".mypy_cache",
    ".ruff_cache",
    ".pytest_cache",
    ".expo",
    ".next",
}


def iter_files(pattern: str = "*"):
    for path in ROOT.rglob(pattern):
        if any(part in IGNORE_DIRS for part in path.relative_to(ROOT).parts):
            continue
        yield path

required = [
    "CLAUDE.md",
    ".mcp.json",
    ".claude/settings.json",
    "prompts/00-initial-plan-mode.md",
    "docs/clinical/intended-use-and-boundary.md",
    "docs/clinical/safety-requirements.md",
    "docs/data/canonical-food-schema.md",
    "docs/security/privacy-and-data-classification.md",
    "packages/dose-engine/src/index.ts",
]
for relative in required:
    if not (ROOT / relative).exists():
        errors.append(f"Missing required file: {relative}")

for path in iter_files("*.json"):
    try:
        json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"Invalid JSON: {path.relative_to(ROOT)}: {exc}")

for forbidden in [".env", "secrets"]:
    target = ROOT / forbidden
    if target.exists():
        errors.append(f"Forbidden path exists: {forbidden}")

secret_regexes = [
    re.compile(r"github_pat_[A-Za-z0-9_]+"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
]
for path in iter_files("*"):
    if not path.is_file() or path.suffix in {".zip", ".png", ".jpg", ".jpeg", ".webp"}:
        continue
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        continue
    for regex in secret_regexes:
        if regex.search(text):
            errors.append(f"Possible secret in {path.relative_to(ROOT)} matching {regex.pattern}")

engine = (ROOT / "packages/dose-engine/src/index.ts").read_text(encoding="utf-8")
for forbidden_import in ["openai", "anthropic", "axios", "fetch(", "applicationinsights", "sentry"]:
    if forbidden_import.lower() in engine.lower():
        errors.append(f"Dose engine contains forbidden dependency or API: {forbidden_import}")

# Traceability discipline: a requirement that claims progress beyond PROPOSED
# must name both an implementation and a test reference, so status cannot drift
# ahead of evidence.
traceability = ROOT / "docs/delivery/traceability.csv"
allowed_statuses = {"PROPOSED", "APPROVED", "IMPLEMENTED", "VERIFIED"}
if not traceability.exists():
    errors.append("Missing traceability file: docs/delivery/traceability.csv")
else:
    with traceability.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        required_columns = {"requirement_id", "implementation_reference", "test_reference", "status"}
        missing_columns = required_columns - set(reader.fieldnames or [])
        if missing_columns:
            errors.append(f"Traceability is missing columns: {', '.join(sorted(missing_columns))}")
        else:
            for row in reader:
                rid = (row.get("requirement_id") or "").strip()
                status = (row.get("status") or "").strip()
                if status not in allowed_statuses:
                    errors.append(f"Traceability {rid}: unknown status '{status}'")
                    continue
                if status != "PROPOSED":
                    if not (row.get("implementation_reference") or "").strip():
                        errors.append(f"Traceability {rid}: status {status} requires an implementation_reference")
                    if not (row.get("test_reference") or "").strip():
                        errors.append(f"Traceability {rid}: status {status} requires a test_reference")

if errors:
    print("Repository validation failed:")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("Repository validation passed.")
print(f"Checked {sum(1 for _ in iter_files())} tracked paths.")
