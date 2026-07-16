"""Tests for structural parsing: fail-closed drift detection, header
normalisation, numeric parsing, and MEASURED/MISSING value-state semantics.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from food_ingestion.portfir import nutrient_map as nm
from food_ingestion.portfir.parser import WorkbookStructureError, coerce_cod, parse_records
from tests.fixtures.make_mini_insa import build_workbook


def test_parse_records_returns_every_row(mini_insa_path: Path) -> None:
    records = parse_records(mini_insa_path, now="2026-07-16T00:00:00Z")
    assert len(records) == 12
    assert {r.source_record_id for r in records} == {
        "10001", "10002", "20001", "30001", "40001", "50001", "60001", "70001", "80001", "90001", "90002",
    }


def test_default_now_is_the_fixed_constant_when_omitted(mini_insa_path: Path) -> None:
    records = parse_records(mini_insa_path)
    assert all(r.import_timestamp == nm.DEFAULT_NOW for r in records)


def test_explicit_now_is_used_verbatim(mini_insa_path: Path) -> None:
    records = parse_records(mini_insa_path, now="2026-07-16T00:00:00Z")
    assert all(r.import_timestamp == "2026-07-16T00:00:00Z" for r in records)


def test_never_writes_to_the_source_workbook(mini_insa_path: Path) -> None:
    before = mini_insa_path.read_bytes()
    parse_records(mini_insa_path, now="2026-07-16T00:00:00Z")
    after = mini_insa_path.read_bytes()
    assert before == after


def test_numeric_cod_is_coerced_to_string_with_a_transformation_note(mini_insa_path: Path) -> None:
    records = parse_records(mini_insa_path, now="2026-07-16T00:00:00Z")
    by_id = {r.source_record_id: r for r in records}
    apple = by_id["30001"]
    assert apple.original_food_name == "Maçã crua"
    assert any("coerced" in note.lower() for note in apple.transformation_notes)


def test_coerce_cod_handles_int_float_str_and_none() -> None:
    assert coerce_cod(40200010) == "40200010"
    assert coerce_cod(40200010.0) == "40200010"
    assert coerce_cod(" 729 ") == "729"
    assert coerce_cod(None) == ""
    with pytest.raises(ValueError):
        coerce_cod(40200010.5)
    with pytest.raises(ValueError):
        coerce_cod(True)


def test_value_state_blank_is_missing_and_zero_is_measured(mini_insa_path: Path) -> None:
    records = parse_records(mini_insa_path, now="2026-07-16T00:00:00Z")
    carrot = next(r for r in records if r.source_record_id == "10002")
    by_column = {n.source_column: n for n in carrot.raw_nutrients}

    # FAT is column H; look it up via the mapping table directly.
    fat_column = next(col for col, m in nm.NUTRIENT_MAP.items() if m.canonical_code == "FAT")
    fat_obs = by_column[fat_column]
    assert fat_obs.value_state == "MEASURED"
    assert fat_obs.original_value == 0

    vita_column = next(col for col, m in nm.NUTRIENT_MAP.items() if m.canonical_code == "VITA")
    vita_obs = by_column[vita_column]
    assert vita_obs.value_state == "MISSING"
    assert vita_obs.original_value is None


def test_duplicate_cod_rows_are_both_preserved_not_deduplicated(mini_insa_path: Path) -> None:
    records = parse_records(mini_insa_path, now="2026-07-16T00:00:00Z")
    duplicates = [r for r in records if r.source_record_id == "10001"]
    assert len(duplicates) == 2
    assert {r.original_food_name for r in duplicates} == {"Feijão cru", "Feijão cru (duplicado)"}


def test_basis_is_ml_only_for_alcoholic_beverages(mini_insa_path: Path) -> None:
    records = parse_records(mini_insa_path, now="2026-07-16T00:00:00Z")
    by_id = {r.source_record_id: r for r in records}
    assert by_id["20001"].basis == "ml"  # Vinho tinto
    assert by_id["10001"].basis == "g"
    assert by_id["30001"].basis == "g"


def test_structural_drift_in_a_nutrient_header_fails_closed(tmp_path: Path) -> None:
    workbook = build_workbook()
    data_sheet = workbook[nm.DATA_SHEET_NAME]
    # Corrupt the "Energia [kcal]" header (column F) beyond whitespace-only
    # drift -- a genuinely different label.
    data_sheet.cell(nm.HEADER_ROW_INDEX, 6, "Some Unexpected Column")
    path = tmp_path / "drifted.xlsx"
    workbook.save(path)

    with pytest.raises(WorkbookStructureError):
        parse_records(path)


def test_missing_sheet_fails_closed(tmp_path: Path) -> None:
    workbook = build_workbook()
    del workbook[nm.INFO_SHEET_NAME]
    path = tmp_path / "missing-sheet.xlsx"
    workbook.save(path)

    with pytest.raises(WorkbookStructureError):
        parse_records(path)


def test_header_whitespace_only_drift_does_not_fail(tmp_path: Path) -> None:
    """Re-wrapping a header (newline -> single space, extra trailing space)
    must NOT be treated as structural drift -- only real content changes.
    """
    workbook = build_workbook()
    data_sheet = workbook[nm.DATA_SHEET_NAME]
    original = data_sheet.cell(nm.HEADER_ROW_INDEX, 6).value
    assert "\n" in original
    data_sheet.cell(nm.HEADER_ROW_INDEX, 6, original.replace("\n", "  ") + "   ")
    path = tmp_path / "rewrapped.xlsx"
    workbook.save(path)

    records = parse_records(path)
    assert len(records) == 12
