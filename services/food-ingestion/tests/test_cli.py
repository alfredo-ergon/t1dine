"""Tests for the four CLI entrypoints: profile, validate, import_data, diff.

Each `main()` is called as a plain function (never via subprocess) so
coverage and assertions stay fast and precise.
"""

from __future__ import annotations

import json
from pathlib import Path

from food_ingestion.portfir import diff, import_data, profile, validate
from food_ingestion.portfir.reporting import read_ndjson


def test_profile_cli_writes_report_and_exits_zero(mini_insa_path: Path, tmp_path: Path, capsys) -> None:
    exit_code = profile.main(["--input", str(mini_insa_path), "--output", str(tmp_path)])
    assert exit_code == 0
    out = capsys.readouterr().out
    assert "bc51a2c1" not in out  # sanity: this is the mini fixture, not the real workbook
    assert "SHA-256" in out
    profile_path = tmp_path / "profile.json"
    assert profile_path.exists()
    report = json.loads(profile_path.read_text(encoding="utf-8"))
    assert report["data_sheet"]["data_row_count"] == 12
    assert report["data_sheet"]["nutrient_column_count"] == 48


def test_validate_cli_exits_nonzero_when_errors_present(mini_insa_path: Path, tmp_path: Path) -> None:
    # The mini fixture deliberately contains ERROR-severity rows (negative
    # value, duplicate Cod, missing name, macro-sum > 120, single macro >
    # 100), so validation must fail closed with a non-zero exit code.
    exit_code = validate.main(["--input", str(mini_insa_path), "--output", str(tmp_path)])
    assert exit_code == 1
    assert (tmp_path / "validation-report.json").exists()
    assert (tmp_path / "validation-report.md").exists()


def test_validate_cli_exits_zero_when_no_errors(tmp_path: Path) -> None:
    from tests.fixtures.make_mini_insa import ROWS, build_workbook

    # A workbook built from only the first (clean, non-duplicated) row has
    # no ERROR findings.
    workbook = build_workbook(rows=[ROWS[0]])
    path = tmp_path / "one-clean-row.xlsx"
    workbook.save(path)

    exit_code = validate.main(["--input", str(path), "--output", str(tmp_path / "out")])
    assert exit_code == 0
    report = json.loads((tmp_path / "out" / "validation-report.json").read_text(encoding="utf-8"))
    assert report["statistics"]["error_count"] == 0


def test_import_data_dry_run_writes_candidate_ndjson(mini_insa_path: Path, tmp_path: Path) -> None:
    exit_code = import_data.main(
        [
            "--input", str(mini_insa_path),
            "--output", str(tmp_path),
            "--now", "2026-07-16T00:00:00Z",
            "--dry-run",
        ]
    )
    assert exit_code == 0

    candidates_path = tmp_path / "dry-run" / "candidates.ndjson"
    raw_path = tmp_path / "dry-run" / "raw-staging.ndjson"
    assert candidates_path.exists()
    assert raw_path.exists()

    candidates = read_ndjson(candidates_path)
    assert len(candidates) == 6  # published (non-quarantined) rows in the fixture
    assert all(food["status"] == "approved" for food in candidates)
    assert all(food["nutrients"][0]["source"]["sourceId"] == "INSA-BDCA" for food in candidates)

    raw_records = read_ndjson(raw_path)
    assert len(raw_records) == 12  # every parsed row, quarantined or not

    snapshot_dir = tmp_path / "dry-run" / "snapshots"
    assert any(snapshot_dir.glob("*.xlsx"))


def test_import_data_non_dry_run_has_no_gate_and_writes_the_same_shape(mini_insa_path: Path, tmp_path: Path) -> None:
    """There is no PORTFIR_PUBLISH_ENABLED / licence gate: the workbook is
    already shipped as an approved catalog under sourceId INSA-BDCA (see
    docs/data/insa_attribution.md). A non-dry-run invocation must succeed
    unconditionally and produce approved / INSA-BDCA-provenance records.
    """
    exit_code = import_data.main(
        [
            "--input", str(mini_insa_path),
            "--output", str(tmp_path),
            "--now", "2026-07-16T00:00:00Z",
        ]
    )
    assert exit_code == 0

    candidates_path = tmp_path / "published" / "candidates.ndjson"
    assert candidates_path.exists()
    candidates = read_ndjson(candidates_path)
    assert len(candidates) == 6
    for food in candidates:
        assert food["status"] == "approved"
        source = food["nutrients"][0]["source"]
        assert source["sourceId"] == "INSA-BDCA"
        assert source["sourceVersion"] == "BDCA v7.1 (2026)"
        assert source["licence"] == "insa-portfir-attribution"
        assert source["mappingVersion"] == "insa-map-2.0"


def test_import_data_output_is_deterministic_across_dry_run_and_publish_modes(mini_insa_path: Path, tmp_path: Path) -> None:
    import_data.main(
        ["--input", str(mini_insa_path), "--output", str(tmp_path), "--now", "2026-07-16T00:00:00Z", "--dry-run"]
    )
    import_data.main(
        ["--input", str(mini_insa_path), "--output", str(tmp_path), "--now", "2026-07-16T00:00:00Z"]
    )
    dry_run_bytes = (tmp_path / "dry-run" / "candidates.ndjson").read_bytes()
    published_bytes = (tmp_path / "published" / "candidates.ndjson").read_bytes()
    assert dry_run_bytes == published_bytes


def test_diff_cli_reports_summary_between_two_import_runs(mini_insa_path: Path, tmp_path: Path, capsys) -> None:
    import_data.main(
        ["--input", str(mini_insa_path), "--output", str(tmp_path / "run1"), "--now", "2026-01-01T00:00:00Z", "--dry-run"]
    )
    import_data.main(
        ["--input", str(mini_insa_path), "--output", str(tmp_path / "run2"), "--now", "2026-12-31T00:00:00Z", "--dry-run"]
    )

    exit_code = diff.main(
        [
            "--previous", str(tmp_path / "run1" / "dry-run" / "candidates.ndjson"),
            "--current", str(tmp_path / "run2" / "dry-run" / "candidates.ndjson"),
            "--output", str(tmp_path),
        ]
    )
    assert exit_code == 0
    out = capsys.readouterr().out
    assert "added" in out

    report = json.loads((tmp_path / "diff-report.json").read_text(encoding="utf-8"))
    # Same data, different --now only -> nothing added/modified/removed.
    assert report["summary"] == {"added": 0, "modified": 0, "removed": 0, "unchanged": 6}
