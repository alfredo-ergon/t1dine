"""Generate ``services/api/src/catalogData/portugalInsa.ts`` from the INSA
workbook.

Deterministic. Reuses this package's parser + quality gate + canonical mapping
so the committed TypeScript catalog is a pure projection of the audited
ingestion pipeline (there is no second, divergent mapping). Only non-quarantined
records are emitted; a nutrient the source did not report is emitted as ``null``
(never ``0``). Provenance (sourceId / licence / attribution / snapshot SHA) is
NOT emitted here -- it is reconstructed by ``insaBuilder.ts`` from its own
constants, which are kept in step with this package.

Usage::

    python -m food_ingestion.portfir.emit_catalog \\
        --input docs/data/insa_tca.xlsx \\
        --out services/api/src/catalogData/portugalInsa.ts
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from . import nutrient_map as nm
from .canonical import to_canonical
from .parser import parse_records, sha256_file
from .quality import run_quality_checks

# Canonical nutrient column order (F..BA). MUST match the order of
# NUTRIENT_DEFINITIONS in packages/food-schema/src/nutrients.ts; insaBuilder.ts
# asserts this at load and fails closed on drift.
CANONICAL_ORDER: list[str] = [nm.map_for_column(letter).canonical_code for letter in nm.NUTRIENT_COLUMNS]

# `now` is irrelevant to the emitted TS (insaBuilder owns provenance/retrievedAt),
# but to_canonical requires one; use a fixed value so emission is deterministic.
_FIXED_NOW = "2026-07-16T00:00:00.000Z"

DEFAULT_OUT = "services/api/src/catalogData/portugalInsa.ts"


def _code_of(food: dict[str, Any]) -> str:
    return str(food["id"]).removeprefix("pt-insa-")


def _pt_name(food: dict[str, Any]) -> str:
    for name in food["names"]:
        if name.get("language") == "pt-PT":
            return name["name"]
    return food["names"][0]["name"]


def _row_for_food(food: dict[str, Any]) -> str:
    code = _code_of(food)
    name = _pt_name(food)
    group = food.get("foodGroup", {})
    level1 = group.get("level1")
    level2 = group.get("level2")
    level3 = group.get("level3")
    prep = food.get("preparationState")
    nutrients = food.get("nutrients", [])
    basis = nutrients[0]["basisUnit"] if nutrients else "g"
    by_code = {obs["nutrientCode"]: obs["value"] for obs in nutrients}
    values = [by_code.get(code_) for code_ in CANONICAL_ORDER]  # None => null (missing)

    fields = [
        json.dumps(code, ensure_ascii=False),
        json.dumps(name, ensure_ascii=False),
        json.dumps(level1, ensure_ascii=False),
        json.dumps(level2, ensure_ascii=False),
        json.dumps(level3, ensure_ascii=False),
        json.dumps(prep, ensure_ascii=False),
        json.dumps(basis, ensure_ascii=False),
        json.dumps(values, ensure_ascii=False, separators=(",", ":")),
    ]
    return "  [" + ",".join(fields) + "]"


def render_ts(foods: list[dict[str, Any]]) -> str:
    order_literal = json.dumps(CANONICAL_ORDER, ensure_ascii=False, separators=(", ", ": "))
    rows = ",\n".join(_row_for_food(food) for food in foods)
    return (
        "// GENERATED from the INSA BDCA v7.1 (2026) workbook by\n"
        "// `python -m food_ingestion.portfir.emit_catalog` — DO NOT EDIT BY HAND.\n"
        "// Real analytical composition; values per 100 g edible (per 100 ml for\n"
        "// alcoholic beverages). `null` = the source did not report that nutrient\n"
        "// (missing / not analysed) — never coerced to 0. Provenance & mandatory\n"
        "// attribution live in ./insaBuilder.ts and docs/data/insa_attribution.md.\n"
        "// The raw workbook is not committed (see .gitignore).\n"
        f"// Foods: {len(foods)}. Nutrient columns: {len(CANONICAL_ORDER)}.\n"
        "\n"
        'import type { CanonicalFood } from "@t1dine/food-schema";\n'
        'import { buildInsaCatalog, type InsaRow } from "./insaBuilder.js";\n'
        "\n"
        "// The nutrient column order `values[]` were generated against. insaBuilder\n"
        "// asserts this still equals the canonical dictionary order.\n"
        f"export const GENERATED_NUTRIENT_ORDER: readonly string[] = {order_literal};\n"
        "\n"
        f"const ROWS: InsaRow[] = [\n{rows},\n];\n"
        "\n"
        "export const PT_INSA: CanonicalFood[] = buildInsaCatalog(ROWS, GENERATED_NUTRIENT_ORDER);\n"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate portugalInsa.ts from the INSA workbook.")
    parser.add_argument("--input", required=True, help="Path to the INSA workbook (.xlsx).")
    parser.add_argument("--out", default=DEFAULT_OUT, help="Output .ts path (default: %(default)s).")
    args = parser.parse_args(argv)

    sha = sha256_file(args.input)
    records = parse_records(args.input, now=_FIXED_NOW)
    report = run_quality_checks(records)
    clean = report.clean_records(records)
    quarantined = report.quarantined_ids

    foods = to_canonical(clean, sha, _FIXED_NOW)
    ts = render_ts(foods)
    Path(args.out).write_text(ts, encoding="utf-8", newline="\n")

    print(f"Wrote {args.out}: {len(foods)} foods, {len(CANONICAL_ORDER)} nutrient columns.", file=sys.stderr)
    if quarantined:
        print(f"Quarantined {len(quarantined)} record(s) (excluded): {sorted(quarantined)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
