"""Tests for report writers: NDJSON round-tripping, validation reports, and
the immutable source-workbook snapshot copy.
"""

from __future__ import annotations

from pathlib import Path

from food_ingestion.portfir.reporting import (
    build_validation_report,
    read_ndjson,
    render_validation_report_markdown,
    snapshot_copy,
    write_json,
    write_ndjson,
    write_raw_ndjson,
    write_validation_report,
)


def test_ndjson_round_trip(tmp_path: Path) -> None:
    items = [{"id": "a", "value": 1}, {"id": "b", "value": 2}]
    path = write_ndjson(items, tmp_path / "out.ndjson")
    assert read_ndjson(path) == items


def test_ndjson_is_one_object_per_line(tmp_path: Path) -> None:
    items = [{"id": "a"}, {"id": "b"}]
    path = write_ndjson(items, tmp_path / "out.ndjson")
    lines = path.read_text(encoding="utf-8").strip("\n").split("\n")
    assert len(lines) == 2


def test_write_raw_ndjson_preserves_field_order(mini_insa_records, tmp_path: Path) -> None:
    path = write_raw_ndjson(mini_insa_records, tmp_path / "raw.ndjson")
    rows = read_ndjson(path)
    assert len(rows) == len(mini_insa_records)
    assert list(rows[0].keys())[:5] == [
        "source_org", "source_dataset", "source_version", "source_record_id", "original_food_name",
    ]


def test_snapshot_copy_is_byte_identical_and_never_touches_source(mini_insa_path: Path, mini_insa_sha256: str, tmp_path: Path) -> None:
    source_before = mini_insa_path.read_bytes()
    destination = snapshot_copy(mini_insa_path, mini_insa_sha256, tmp_path)
    assert destination == tmp_path / "snapshots" / f"{mini_insa_sha256}.xlsx"
    assert destination.read_bytes() == source_before
    assert mini_insa_path.read_bytes() == source_before


def test_snapshot_copy_is_idempotent(mini_insa_path: Path, mini_insa_sha256: str, tmp_path: Path) -> None:
    first = snapshot_copy(mini_insa_path, mini_insa_sha256, tmp_path)
    first_mtime = first.stat().st_mtime_ns
    second = snapshot_copy(mini_insa_path, mini_insa_sha256, tmp_path)
    assert second == first
    assert second.stat().st_mtime_ns == first_mtime  # not re-copied


def test_validation_report_statistics_match_quality_report(
    mini_insa_records, mini_insa_quality_report, mini_insa_sha256, mini_insa_canonical
) -> None:
    report = build_validation_report(
        mini_insa_records, mini_insa_quality_report, mini_insa_sha256, mini_insa_canonical
    )
    stats = report["statistics"]
    assert stats["total_records"] == len(mini_insa_records)
    assert stats["published_count"] == len(mini_insa_canonical)
    assert stats["quarantined_count"] == len(mini_insa_quality_report.quarantined_ids)
    assert stats["error_count"] == len(mini_insa_quality_report.errors)
    assert stats["warning_count"] == len(mini_insa_quality_report.warnings)


def test_markdown_report_renders_without_error(
    mini_insa_records, mini_insa_quality_report, mini_insa_sha256, mini_insa_canonical
) -> None:
    report = build_validation_report(
        mini_insa_records, mini_insa_quality_report, mini_insa_sha256, mini_insa_canonical
    )
    markdown = render_validation_report_markdown(report)
    assert "# PortFIR import validation report" in markdown
    assert mini_insa_sha256 in markdown


def test_write_validation_report_writes_both_formats(
    mini_insa_records, mini_insa_quality_report, mini_insa_sha256, mini_insa_canonical, tmp_path: Path
) -> None:
    json_path, markdown_path = write_validation_report(
        mini_insa_records, mini_insa_quality_report, mini_insa_sha256, tmp_path, mini_insa_canonical
    )
    assert json_path.exists()
    assert markdown_path.exists()


def test_write_json_is_valid_utf8(tmp_path: Path) -> None:
    path = write_json({"name": "Feijão"}, tmp_path / "out.json")
    assert "Feijão" in path.read_text(encoding="utf-8")
