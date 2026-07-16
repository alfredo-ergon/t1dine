"""CLI: ``python -m food_ingestion.portfir.validate --input <workbook.xlsx>
[--output <dir>] [--now <iso8601>]``

Parses the workbook and runs quality checks, writing a validation report
(JSON + Markdown). Exits non-zero if any ERROR-severity finding was raised
(the workbook is never modified either way -- it is only ever opened
read-only).
"""

from __future__ import annotations

import argparse

from .parser import WorkbookStructureError, parse_records, sha256_file
from .quality import run_quality_checks
from .reporting import write_validation_report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m food_ingestion.portfir.validate",
        description="Validate a PortFIR (INSA BDCA) workbook and write a quality report.",
    )
    parser.add_argument("--input", required=True, help="Path to the .xlsx workbook to validate.")
    parser.add_argument(
        "--output", default="output/portfir", help="Directory to write the validation report into."
    )
    parser.add_argument(
        "--now",
        default=None,
        help="ISO-8601 timestamp for import_timestamp (default: fixed deterministic constant).",
    )
    args = parser.parse_args(argv)

    try:
        records = parse_records(args.input, now=args.now)
    except WorkbookStructureError as exc:
        print(f"BLOCKED: workbook structure error: {exc}")
        return 2

    sha256 = sha256_file(args.input)
    report = run_quality_checks(records)
    json_path, markdown_path = write_validation_report(records, report, sha256, args.output)

    summary = report.summary()
    print(f"Records parsed: {len(records)}")
    print(f"Errors: {summary['error_count']}  Warnings: {summary['warning_count']}")
    print(f"Quarantined records: {summary['quarantined_record_count']}")
    print(f"Wrote {json_path} and {markdown_path}")

    return 1 if report.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
