"""Tests for quality checks and quarantine classification.

Precise boundary cases (macro-sum thresholds, unknown units, ...) are built
directly as `PortfirSourceRecord`s rather than via the workbook fixture, so
the exact numeric edges are unambiguous and independent of the fixture's
other scenarios.
"""

from __future__ import annotations

import copy
import dataclasses

from food_ingestion.portfir import nutrient_map as nm
from food_ingestion.portfir.parser import PortfirSourceRecord, RawNutrientValue
from food_ingestion.portfir.quality import KNOWN_LEVEL1_VARIANT_GROUPS, run_quality_checks

FIXED_NOW = "1970-01-01T00:00:00Z"


def _record(
    cod: str,
    name: str = "Teste",
    level1: str = "Pratos compostos",
    level2: str = "Teste",
    level3: str | None = None,
    basis: str = "g",
    values: dict[str, float] | None = None,
) -> PortfirSourceRecord:
    values = values or {}
    raw_nutrients: list[RawNutrientValue] = []
    for column, mapping in nm.NUTRIENT_MAP.items():
        if mapping.canonical_code in values:
            raw_nutrients.append(
                RawNutrientValue(
                    source_column=column,
                    source_label=mapping.source_label,
                    original_value=values[mapping.canonical_code],
                    original_unit=mapping.source_unit,
                    value_state="MEASURED",
                )
            )
        else:
            raw_nutrients.append(
                RawNutrientValue(
                    source_column=column,
                    source_label=mapping.source_label,
                    original_value=None,
                    original_unit=mapping.source_unit,
                    value_state="MISSING",
                )
            )
    return PortfirSourceRecord(
        source_org=nm.SOURCE_ORG,
        source_dataset=nm.SOURCE_DATASET,
        source_version=nm.SOURCE_VERSION,
        source_record_id=cod,
        original_food_name=name,
        foodex2_level1=level1,
        foodex2_level2=level2,
        foodex2_level3=level3,
        basis=basis,
        raw_nutrients=raw_nutrients,
        import_timestamp=FIXED_NOW,
        importer_version=nm.IMPORTER_VERSION,
        source_file_sha256="0" * 64,
        mapping_version=nm.MAPPING_VERSION,
        licence_status=nm.LICENCE_STATUS,
        attribution=nm.ATTRIBUTION,
        transformation_notes=[],
    )


def test_negative_value_is_error_and_quarantines() -> None:
    record = _record("1", values={"NA": -5, "CHOAVL": 10})
    report = run_quality_checks([record])
    assert any(f.check == "negative_value" and f.severity == "error" for f in report.findings)
    assert "1" in report.quarantined_ids


def test_single_macro_over_100_is_error() -> None:
    record = _record("1", values={"WATER": 101})
    report = run_quality_checks([record])
    findings = [f for f in report.findings if f.check == "implausible_single_macro"]
    assert len(findings) == 1
    assert findings[0].severity == "error"
    assert "1" in report.quarantined_ids


def test_single_macro_at_exactly_100_is_not_flagged() -> None:
    record = _record("1", values={"WATER": 100})
    report = run_quality_checks([record])
    assert not any(f.check == "implausible_single_macro" for f in report.findings)
    assert "1" not in report.quarantined_ids


def test_macro_sum_between_105_and_120_is_warning_not_quarantined() -> None:
    # FAT+CHOAVL+PROCNT+WATER+ASH+ALC+FIBTG = 108, no single value > 100.
    record = _record("1", values={"FAT": 30, "CHOAVL": 2, "PROCNT": 25, "WATER": 48, "ASH": 3})
    report = run_quality_checks([record])
    findings = [f for f in report.findings if f.check == "implausible_macro_sum"]
    assert len(findings) == 1
    assert findings[0].severity == "warning"
    assert "1" not in report.quarantined_ids


def test_macro_sum_over_120_is_error_and_quarantines() -> None:
    # Sum = 140, no single value > 100.
    record = _record("1", values={"FAT": 60, "CHOAVL": 50, "PROCNT": 20, "WATER": 10})
    report = run_quality_checks([record])
    findings = [f for f in report.findings if f.check == "implausible_macro_sum"]
    assert len(findings) == 1
    assert findings[0].severity == "error"
    assert "1" in report.quarantined_ids


def test_macro_sum_at_exactly_105_is_not_flagged() -> None:
    record = _record("1", values={"FAT": 100, "WATER": 5})
    report = run_quality_checks([record])
    assert not any(f.check == "implausible_macro_sum" for f in report.findings)


def test_energy_consistency_within_tolerance_is_silent() -> None:
    record = _record("1", values={"ENERC": 100, "ENERC_KJ": 418.4})
    report = run_quality_checks([record])
    assert not any(f.check == "energy_consistency" for f in report.findings)


def test_energy_consistency_outside_tolerance_is_warning_not_quarantined() -> None:
    record = _record("1", values={"ENERC": 100, "ENERC_KJ": 100})
    report = run_quality_checks([record])
    findings = [f for f in report.findings if f.check == "energy_consistency"]
    assert len(findings) == 1
    assert findings[0].severity == "warning"
    assert "1" not in report.quarantined_ids


def test_energy_consistency_zero_kcal_nonzero_kj_is_warning() -> None:
    record = _record("1", values={"ENERC": 0, "ENERC_KJ": 5})
    report = run_quality_checks([record])
    assert any(f.check == "energy_consistency" and f.severity == "warning" for f in report.findings)


def test_carb_fibre_sanity_is_warning_not_quarantined() -> None:
    record = _record("1", values={"CHOAVL": 5, "FIBTG": 40})
    report = run_quality_checks([record])
    findings = [f for f in report.findings if f.check == "carb_fibre_sanity"]
    assert len(findings) == 1
    assert findings[0].severity == "warning"
    assert "1" not in report.quarantined_ids


def test_carb_fibre_sanity_not_flagged_when_fibre_below_threshold() -> None:
    record = _record("1", values={"CHOAVL": 5, "FIBTG": 8})
    report = run_quality_checks([record])
    assert not any(f.check == "carb_fibre_sanity" for f in report.findings)


def test_missing_food_name_is_error_and_quarantines() -> None:
    record = _record("1", name="", values={"ENERC": 10})
    report = run_quality_checks([record])
    assert any(f.check == "missing_food_name" and f.severity == "error" for f in report.findings)
    assert "1" in report.quarantined_ids


def test_unknown_unit_is_error() -> None:
    record = _record("1", values={"CHOAVL": 5})
    bad_nutrient = RawNutrientValue(
        source_column="F",
        source_label="Energia [kcal]",
        original_value=10,
        original_unit="lbs",  # Not a real INSA unit.
        value_state="MEASURED",
    )
    record = dataclasses.replace(record, raw_nutrients=[bad_nutrient, *record.raw_nutrients])
    report = run_quality_checks([record])
    assert any(f.check == "unknown_unit" and f.severity == "error" for f in report.findings)
    assert "1" in report.quarantined_ids


def test_duplicate_cod_quarantines_all_sharing_records() -> None:
    records = [_record("1", name="A"), _record("1", name="B"), _record("2", name="C")]
    report = run_quality_checks(records)
    duplicate_findings = [f for f in report.findings if f.check == "duplicate_cod"]
    assert len(duplicate_findings) == 2
    assert all(f.severity == "error" for f in duplicate_findings)
    assert report.quarantined_ids == {"1"}
    clean = report.clean_records(records)
    assert [r.source_record_id for r in clean] == ["2"]


def test_known_level1_variant_pair_is_warning_when_both_present() -> None:
    group = next(iter(KNOWN_LEVEL1_VARIANT_GROUPS))
    variant_a, variant_b = sorted(group)
    records = [_record("1", level1=variant_a), _record("2", level1=variant_b)]
    report = run_quality_checks(records)
    findings = [f for f in report.findings if f.check == "level1_known_variant"]
    assert len(findings) == 2
    assert all(f.severity == "warning" for f in findings)
    assert report.quarantined_ids == set()


def test_known_level1_variant_silent_when_only_one_spelling_present() -> None:
    variant_a = sorted(next(iter(KNOWN_LEVEL1_VARIANT_GROUPS)))[0]
    records = [_record("1", level1=variant_a), _record("2", level1=variant_a)]
    report = run_quality_checks(records)
    assert not any(f.check == "level1_known_variant" for f in report.findings)


def test_generic_level3_label_variant_detected_by_normalisation() -> None:
    records = [
        _record("1", level3="Pomóideas"),
        _record("2", level3="pomóideas "),
        _record("3", level3="Citrinos"),
    ]
    report = run_quality_checks(records)
    findings = {f.source_record_id for f in report.findings if f.check == "level3_label_variant"}
    assert findings == {"1", "2"}
    assert all(
        f.severity == "warning" for f in report.findings if f.check == "level3_label_variant"
    )


def test_run_quality_checks_never_mutates_input_records() -> None:
    records = [_record("1", values={"NA": -5}), _record("2", values={"CHOAVL": 5})]
    before = copy.deepcopy(records)
    run_quality_checks(records)
    assert records == before


def test_quarantine_never_alters_the_record_values() -> None:
    record = _record("1", values={"NA": -5, "CHOAVL": 10})
    report = run_quality_checks([record])
    assert "1" in report.quarantined_ids
    na_column = next(col for col, m in nm.NUTRIENT_MAP.items() if m.canonical_code == "NA")
    na_observation = next(n for n in record.raw_nutrients if n.source_column == na_column)
    # The negative value is preserved verbatim -- never "fixed" to 0 or positive.
    assert na_observation.original_value == -5
    assert na_observation.value_state == "MEASURED"
