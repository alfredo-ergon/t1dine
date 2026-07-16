"""Tests for the 48-column nutrient mapping table (the adapter's single
source of truth) and its two legend-only "declared but absent" codes.
"""

from __future__ import annotations

import pytest

from food_ingestion.portfir import nutrient_map as nm


def test_full_48_column_mapping_resolves_by_position() -> None:
    assert len(nm.NUTRIENT_MAP) == 48
    assert len(nm.NUTRIENT_COLUMNS) == 48
    assert nm.NUTRIENT_COLUMNS[0] == "F"
    assert nm.NUTRIENT_COLUMNS[-1] == "BA"
    for column in nm.NUTRIENT_COLUMNS:
        mapping = nm.map_for_column(column)
        assert mapping.source_column == column
        assert mapping.canonical_code
        assert mapping.canonical_unit in {"g", "mg", "µg", "kcal", "kJ"}


def test_unmapped_column_fails_closed() -> None:
    with pytest.raises(nm.UnmappedColumnError):
        nm.map_for_column("ZZ")


def test_tocpha_label_variant_documented() -> None:
    mapping = nm.map_for_column("AH")
    assert mapping.canonical_code == "TOCPHA"
    assert "alfa-tocoferol" in mapping.notes
    assert "α-tocoferol" in mapping.source_label


def test_declared_but_absent_legend_only_codes() -> None:
    codes = {entry.canonical_code for entry in nm.DECLARED_BUT_ABSENT}
    assert codes == {"SUCS", "LACS"}
    mapped_codes = {mapping.canonical_code for mapping in nm.NUTRIENT_MAP.values()}
    for entry in nm.DECLARED_BUT_ABSENT:
        assert entry.unit == "g"
        # Genuinely absent: no data column maps to SUCS/LACS.
        assert entry.canonical_code not in mapped_codes


def test_confidence_is_unit_derived_only() -> None:
    """One rule, applied identically to every observation: high iff the
    canonical unit is g/kcal/kJ; every mg and µg nutrient -- including
    sodium, cholesterol, minerals, and vitamins -- defaults to medium.
    """
    for mapping in nm.NUTRIENT_MAP.values():
        expected = "high" if mapping.canonical_unit in {"g", "kcal", "kJ"} else "medium"
        assert mapping.confidence == expected, mapping.canonical_code

    # Spot checks called out explicitly in the brief.
    assert nm.map_for_column("AS").canonical_code == "NA"  # Sodio
    assert nm.map_for_column("AS").confidence == "medium"
    assert nm.map_for_column("X").canonical_code == "CHOLE"  # Colesterol
    assert nm.map_for_column("X").confidence == "medium"
    assert nm.map_for_column("N").canonical_code == "CHOAVL"  # Hidratos de carbono
    assert nm.map_for_column("N").confidence == "high"
    assert nm.map_for_column("F").canonical_code == "ENERC"
    assert nm.map_for_column("F").confidence == "high"


def test_micrograms_unit_is_micro_sign_u00b5() -> None:
    """Must be U+00B5 MICRO SIGN, matching both the workbook headers and the
    TypeScript domain package's NutrientObservation.unit enum -- not
    U+03BC GREEK SMALL LETTER MU, which looks identical but is a different
    code point.
    """
    micro_gram_mappings = [m for m in nm.NUTRIENT_MAP.values() if m.canonical_unit == "µg"]
    assert micro_gram_mappings, "expected at least one µg-unit mapping"
    for mapping in micro_gram_mappings:
        assert mapping.canonical_unit == "µg"
        assert "μ" not in mapping.canonical_unit


def test_expected_header_text_covers_all_53_columns() -> None:
    for column_index in range(1, nm.EXPECTED_COLUMN_COUNT + 1):
        text = nm.expected_header_text(column_index)
        assert isinstance(text, str)
        assert text.strip() != ""


def test_normalize_header_collapses_whitespace_and_newlines() -> None:
    assert nm.normalize_header("Energia\n[kcal] ") == "Energia [kcal]"
    assert nm.normalize_header("  a   b\n\nc ") == "a b c"
    assert nm.normalize_header(None) == ""


def test_alcoholic_beverages_level1_label_matches_real_workbook() -> None:
    assert nm.ALCOHOLIC_BEVERAGES_LEVEL1 == "Bebidas alcoólicas"
