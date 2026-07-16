"""CLI: ``python -m food_ingestion.portfir.profile --input <workbook.xlsx>
[--output <dir>]``

Read-only structural profile of a PortFIR (INSA BDCA) workbook: sheet names,
dimensions, merged ranges, formula/hidden-content counts, per-nutrient
missing-value counts, duplicate ``Cod`` detection, and distinct food-group
counts. Never writes to the input file.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from .profiler import profile_workbook
from .reporting import write_json


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m food_ingestion.portfir.profile",
        description="Read-only structural profile of a PortFIR (INSA BDCA) workbook.",
    )
    parser.add_argument("--input", required=True, help="Path to the .xlsx workbook to profile.")
    parser.add_argument("--output", default=None, help="Directory to write profile.json into (optional).")
    args = parser.parse_args(argv)

    report = profile_workbook(args.input)
    data_sheet = report.get("data_sheet", {})

    print(f"Workbook: {report['path']}")
    print(f"SHA-256: {report['sha256']}")
    print(f"Size: {report['size_bytes']} bytes")
    print(f"Sheets: {report['sheet_names']}")
    print(f"Formula count: {report['formula_count']}")
    print(f"Data rows: {data_sheet.get('data_row_count', 'n/a')}")
    print(f"Nutrient columns: {data_sheet.get('nutrient_column_count', 'n/a')}")
    print(f"Distinct Cod count: {data_sheet.get('distinct_cod_count', 'n/a')}")
    print(f"Duplicate Cods: {data_sheet.get('duplicate_cods', {})}")

    if args.output:
        path = write_json(report, Path(args.output) / "profile.json")
        print(f"Wrote profile to {path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
