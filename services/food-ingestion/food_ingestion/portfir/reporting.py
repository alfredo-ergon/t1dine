"""Report writers for the PortFIR ingestion pipeline: validation reports
(JSON + Markdown), NDJSON writers for raw-staging and canonical records, and
an immutable snapshot copy of the source workbook.

Every write here targets *output* artefacts under a caller-supplied output
directory -- this module never writes to the source workbook, which is only
ever opened read-only elsewhere in this package (see parser.py/profiler.py).
"""

from __future__ import annotations

import json
import shutil
from dataclasses import asdict
from pathlib import Path
from typing import Any, Iterable

from .parser import PortfirSourceRecord
from .quality import QualityReport


def write_ndjson(items: Iterable[dict[str, Any]], path: str | Path) -> Path:
    """Write one JSON object per line. Field order within each object is
    whatever the caller constructed (dict insertion order), not re-sorted --
    this keeps output byte-identical across reruns of the same input without
    depending on hash-based ordering anywhere.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        for item in items:
            handle.write(json.dumps(item, ensure_ascii=False))
            handle.write("\n")
    return path


def read_ndjson(path: str | Path) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                items.append(json.loads(line))
    return items


def write_json(obj: Any, path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(obj, handle, ensure_ascii=False, indent=2, sort_keys=True)
        handle.write("\n")
    return path


def raw_record_to_dict(record: PortfirSourceRecord) -> dict[str, Any]:
    return asdict(record)


def write_raw_ndjson(records: list[PortfirSourceRecord], path: str | Path) -> Path:
    return write_ndjson((raw_record_to_dict(record) for record in records), path)


def snapshot_copy(source_path: str | Path, sha256: str, output_dir: str | Path) -> Path:
    """Copy the source workbook's bytes, byte-for-byte and unmodified, to
    `<output_dir>/snapshots/<sha256>.xlsx`. Never writes to `source_path`.
    Idempotent: a second call with the same sha256 is a no-op.
    """
    source_path = Path(source_path)
    destination = Path(output_dir) / "snapshots" / f"{sha256}.xlsx"
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        shutil.copyfile(source_path, destination)
    return destination


def build_import_statistics(
    records: list[PortfirSourceRecord],
    quality_report: QualityReport,
    canonical_foods: list[dict[str, Any]],
) -> dict[str, Any]:
    nutrient_observation_count = sum(len(food.get("nutrients", [])) for food in canonical_foods)
    return {
        "total_records": len(records),
        "published_count": len(canonical_foods),
        "quarantined_count": len(quality_report.quarantined_ids),
        "error_count": len(quality_report.errors),
        "warning_count": len(quality_report.warnings),
        "nutrient_observation_count": nutrient_observation_count,
        "findings_by_check": quality_report.summary()["findings_by_check"],
    }


def build_validation_report(
    records: list[PortfirSourceRecord],
    quality_report: QualityReport,
    sha256: str,
    canonical_foods: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    canonical_foods = canonical_foods or []
    return {
        "source_file_sha256": sha256,
        "statistics": build_import_statistics(records, quality_report, canonical_foods),
        "quarantined_ids": sorted(quality_report.quarantined_ids),
        "findings": [
            {
                "check": finding.check,
                "severity": finding.severity,
                "source_record_id": finding.source_record_id,
                "message": finding.message,
                "details": finding.details,
            }
            for finding in quality_report.findings
        ],
    }


def render_validation_report_markdown(report: dict[str, Any]) -> str:
    stats = report["statistics"]
    lines = [
        "# PortFIR import validation report",
        "",
        f"Source workbook SHA-256: `{report['source_file_sha256']}`",
        "",
        "## Statistics",
        "",
        f"- Total records parsed: {stats['total_records']}",
        f"- Published (canonical) records: {stats['published_count']}",
        f"- Quarantined records: {stats['quarantined_count']}",
        f"- Error findings: {stats['error_count']}",
        f"- Warning findings: {stats['warning_count']}",
        f"- Nutrient observations emitted: {stats['nutrient_observation_count']}",
        "",
        "### Findings by check",
        "",
    ]
    for check, count in sorted(stats["findings_by_check"].items()):
        lines.append(f"- `{check}`: {count}")

    lines.extend(["", "## Findings", ""])
    if not report["findings"]:
        lines.append("No findings.")
    else:
        lines.append("| Severity | Check | Record | Message |")
        lines.append("|---|---|---|---|")
        for finding in report["findings"]:
            message = finding["message"].replace("|", "\\|")
            lines.append(
                f"| {finding['severity']} | {finding['check']} | "
                f"{finding['source_record_id']} | {message} |"
            )
    lines.append("")
    return "\n".join(lines)


def write_validation_report(
    records: list[PortfirSourceRecord],
    quality_report: QualityReport,
    sha256: str,
    output_dir: str | Path,
    canonical_foods: list[dict[str, Any]] | None = None,
) -> tuple[Path, Path]:
    report = build_validation_report(records, quality_report, sha256, canonical_foods)
    json_path = write_json(report, Path(output_dir) / "validation-report.json")
    markdown_path = Path(output_dir) / "validation-report.md"
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.write_text(render_validation_report_markdown(report), encoding="utf-8", newline="\n")
    return json_path, markdown_path
