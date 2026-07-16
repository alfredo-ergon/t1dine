"""CLI: ``python -m food_ingestion.portfir.import_data --input
<workbook.xlsx> [--dry-run] [--now <iso8601>] [--output <dir>]``

Parses the workbook, runs quality checks, promotes quality-clean records to
CanonicalFood dicts (status ``"approved"``, ``INSA-BDCA`` provenance -- see
:mod:`food_ingestion.portfir.canonical`), and writes: the raw staging
NDJSON, the canonical NDJSON, the validation report (JSON + Markdown), and
an immutable snapshot copy of the source workbook. Quarantined records are
excluded from the canonical NDJSON but remain, unmutated, in the raw staging
NDJSON and the validation report.

This package has no live database/API publish target -- both ``--dry-run``
(the safe default for previewing output) and the non-dry-run mode write the
same local NDJSON artefacts; ``--dry-run`` writes under a ``dry-run/``
subdirectory so a preview run can never collide with a previously-written
"published" output directory.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from . import nutrient_map as nm
from .canonical import to_canonical
from .parser import WorkbookStructureError, parse_records, sha256_file
from .quality import run_quality_checks
from .reporting import snapshot_copy, write_ndjson, write_raw_ndjson, write_validation_report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m food_ingestion.portfir.import_data",
        description=(
            "Parse, validate, and promote a PortFIR (INSA BDCA) workbook to "
            "CanonicalFood NDJSON."
        ),
    )
    parser.add_argument("--input", required=True, help="Path to the .xlsx workbook to import.")
    parser.add_argument("--output", default="output/portfir", help="Base output directory.")
    parser.add_argument(
        "--now",
        default=None,
        help="ISO-8601 timestamp for import_timestamp/retrievedAt (default: fixed deterministic constant).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help=(
            "Write output under a dry-run/ subdirectory instead of published/. "
            "Always safe -- there is no database/API this package publishes to "
            "either way."
        ),
    )
    args = parser.parse_args(argv)

    effective_now = args.now if args.now is not None else nm.DEFAULT_NOW

    try:
        records = parse_records(args.input, now=effective_now)
    except WorkbookStructureError as exc:
        print(f"BLOCKED: workbook structure error: {exc}")
        return 2

    sha256 = sha256_file(args.input)
    quality_report = run_quality_checks(records)
    clean_records = quality_report.clean_records(records)
    canonical_foods = to_canonical(clean_records, sha256, effective_now)

    output_dir = Path(args.output) / ("dry-run" if args.dry_run else "published")
    raw_path = write_raw_ndjson(records, output_dir / "raw-staging.ndjson")
    canonical_path = write_ndjson(canonical_foods, output_dir / "candidates.ndjson")
    json_report_path, markdown_report_path = write_validation_report(
        records, quality_report, sha256, output_dir, canonical_foods
    )
    snapshot_path = snapshot_copy(args.input, sha256, output_dir)

    summary = quality_report.summary()
    print(f"Mode: {'dry-run' if args.dry_run else 'publish'}")
    print(f"Records parsed: {len(records)}")
    print(f"Published (canonical) records: {len(canonical_foods)}")
    print(f"Quarantined records: {summary['quarantined_record_count']}")
    print(f"Wrote raw staging NDJSON: {raw_path}")
    print(f"Wrote canonical NDJSON: {canonical_path}")
    print(f"Wrote validation report: {json_report_path}, {markdown_report_path}")
    print(f"Snapshot copy: {snapshot_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
