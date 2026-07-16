"""Tests for the read-only structural profiler."""

from __future__ import annotations

from pathlib import Path

from food_ingestion.portfir import nutrient_map as nm
from food_ingestion.portfir.parser import sha256_file
from food_ingestion.portfir.profiler import profile_workbook


def test_profile_workbook_reports_expected_shape(mini_insa_path: Path, mini_insa_sha256: str) -> None:
    report = profile_workbook(mini_insa_path)

    assert report["sha256"] == mini_insa_sha256
    assert report["sheet_names"] == list(nm.EXPECTED_SHEET_NAMES)
    assert report["formula_count"] == 0

    data_sheet = report["data_sheet"]
    assert data_sheet["data_row_count"] == 12
    assert data_sheet["nutrient_column_count"] == 48
    assert data_sheet["distinct_cod_count"] == 11  # 12 rows, one Cod reused
    assert data_sheet["duplicate_cods"] == {"10001": 2}


def test_profile_workbook_never_mutates_the_source_file(mini_insa_path: Path) -> None:
    before = mini_insa_path.read_bytes()
    profile_workbook(mini_insa_path)
    after = mini_insa_path.read_bytes()
    assert before == after


def test_profile_workbook_detects_no_hidden_content_or_named_ranges(mini_insa_path: Path) -> None:
    report = profile_workbook(mini_insa_path)
    assert report["named_ranges"] == []
    for sheet in report["sheets"].values():
        assert sheet["hidden_columns"] == []
        assert sheet["hidden_rows"] == []


def test_profile_workbook_missing_value_counts_sum_to_total_cells(mini_insa_path: Path) -> None:
    report = profile_workbook(mini_insa_path)
    data_sheet = report["data_sheet"]
    total_missing = sum(data_sheet["missing_value_counts"].values())
    total_measured = sum(data_sheet["measured_value_counts"].values())
    assert total_missing + total_measured == data_sheet["data_row_count"] * 48
