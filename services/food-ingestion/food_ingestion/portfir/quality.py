"""Quality checks and quarantine classification for parsed PortFIR staging
records.

Every finding is classified ``error`` or ``warning``. Records with at least
one ``error`` finding are quarantined: excluded from the canonical publish
set by :func:`QualityReport.clean_records`, but the staging record itself is
never mutated -- it stays available, unchanged, for audit and re-review.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from . import nutrient_map as nm
from .parser import PortfirSourceRecord

KNOWN_UNITS: frozenset[str] = frozenset({"kcal", "kJ", "g", "mg", "µg"})

# Gram-valued nutrient codes subject to the "implausible per-100g/ml macro"
# checks below. Energy (kcal/kJ) and mg/µg micronutrients are not capped by
# these percentage-of-100 rules.
_MACRO_GRAM_CODES: frozenset[str] = frozenset(
    mapping.canonical_code for mapping in nm.NUTRIENT_MAP.values() if mapping.canonical_unit == "g"
)

_MACRO_SUM_CODES: tuple[str, ...] = ("FAT", "CHOAVL", "PROCNT", "WATER", "ASH", "ALC", "FIBTG")
# Independently-analysed macro components routinely sum to slightly over
# 100 g/100g in legitimate, professionally-curated composition data (cured
# cheeses, dried fruit/nuts, flours, wines, ...): each is measured by an
# independent method, available-carbohydrate and fibre are separate
# fractions, and rounding compounds. Verified against the full real BDCA
# v7.1-2026 export: 18 of 1376 records sum to 105-110.8 g. That is normal
# analytical variance, not an error -- only a WARNING (reported for human
# review, never quarantined). A sum this "grossly" over 100 that it can only
# be a data error (e.g. a misplaced decimal or duplicated value) escalates
# to an ERROR instead.
_MACRO_SUM_WARNING_THRESHOLD = 105.0
_MACRO_SUM_ERROR_THRESHOLD = 120.0
_SINGLE_MACRO_MAX = 100.0
_ENERGY_KJ_PER_KCAL = 4.184
_ENERGY_TOLERANCE = 0.05
_CARB_FIBRE_MIN_FIBRE = 15.0

# The known Level-1 (FoodEx2) near-duplicate spelling in BDCA v7.1-2026:
# same taxonomic group, two different transcriptions. Verified against the
# real workbook (84 rows use the first spelling, 1 row uses the second).
# Reported as a WARNING, never blocking -- this is a labelling inconsistency
# in the source, not a value-quality problem.
KNOWN_LEVEL1_VARIANT_GROUPS: tuple[frozenset[str], ...] = (
    frozenset(
        {
            "Leguminosas, frutos de casca rija, sementes oleaginosas e especiarias",
            "Leguminosas, nozes, oleaginosas e especiarias.",
        }
    ),
)


@dataclass(frozen=True)
class Finding:
    check: str
    severity: str  # "error" | "warning"
    source_record_id: str
    message: str
    details: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class QualityReport:
    findings: list[Finding]

    @property
    def errors(self) -> list[Finding]:
        return [finding for finding in self.findings if finding.severity == "error"]

    @property
    def warnings(self) -> list[Finding]:
        return [finding for finding in self.findings if finding.severity == "warning"]

    @property
    def quarantined_ids(self) -> set[str]:
        return {finding.source_record_id for finding in self.errors}

    def clean_records(self, records: list[PortfirSourceRecord]) -> list[PortfirSourceRecord]:
        """Records with no ERROR-severity finding -- safe to promote to canonical."""
        quarantined = self.quarantined_ids
        return [record for record in records if record.source_record_id not in quarantined]

    def quarantined_records(self, records: list[PortfirSourceRecord]) -> list[PortfirSourceRecord]:
        quarantined = self.quarantined_ids
        return [record for record in records if record.source_record_id in quarantined]

    def summary(self) -> dict[str, Any]:
        return {
            "total_findings": len(self.findings),
            "error_count": len(self.errors),
            "warning_count": len(self.warnings),
            "quarantined_record_count": len(self.quarantined_ids),
            "findings_by_check": _count_by_check(self.findings),
        }


def _count_by_check(findings: list[Finding]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for finding in findings:
        counts[finding.check] = counts.get(finding.check, 0) + 1
    return counts


def _normalize_label(text: str) -> str:
    return " ".join((text or "").strip().lower().rstrip(".").split())


def _value_by_code(record: PortfirSourceRecord, code: str) -> float | int | None:
    for raw in record.raw_nutrients:
        if raw.value_state != "MEASURED":
            continue
        mapping = nm.map_for_column(raw.source_column)
        if mapping.canonical_code == code:
            return raw.original_value
    return None


def run_quality_checks(records: list[PortfirSourceRecord]) -> QualityReport:
    """Pure function -- never mutates `records`. Returns every finding across
    the whole record set (both per-record and cross-record checks).
    """
    findings: list[Finding] = []
    findings.extend(_check_negative_values(records))
    findings.extend(_check_implausible_macros(records))
    findings.extend(_check_energy_consistency(records))
    findings.extend(_check_carb_fibre_sanity(records))
    findings.extend(_check_missing_food_name(records))
    findings.extend(_check_unknown_units(records))
    findings.extend(_check_duplicate_cod(records))
    findings.extend(_check_label_variants(records, level="level1", getter=lambda r: r.foodex2_level1))
    findings.extend(_check_label_variants(records, level="level3", getter=lambda r: r.foodex2_level3))
    findings.extend(_check_known_level1_variants(records))
    return QualityReport(findings=findings)


def _check_negative_values(records: list[PortfirSourceRecord]) -> list[Finding]:
    findings: list[Finding] = []
    for record in records:
        for raw in record.raw_nutrients:
            if raw.value_state != "MEASURED":
                continue
            if isinstance(raw.original_value, (int, float)) and raw.original_value < 0:
                mapping = nm.map_for_column(raw.source_column)
                findings.append(
                    Finding(
                        check="negative_value",
                        severity="error",
                        source_record_id=record.source_record_id,
                        message=(
                            f"Negative value {raw.original_value!r} for "
                            f"{mapping.canonical_code} ({raw.source_column})."
                        ),
                        details={"nutrient_code": mapping.canonical_code, "value": raw.original_value},
                    )
                )
    return findings


def _check_implausible_macros(records: list[PortfirSourceRecord]) -> list[Finding]:
    findings: list[Finding] = []
    for record in records:
        values_by_code: dict[str, float] = {}
        for raw in record.raw_nutrients:
            if raw.value_state != "MEASURED":
                continue
            mapping = nm.map_for_column(raw.source_column)
            if mapping.canonical_code in _MACRO_GRAM_CODES:
                values_by_code[mapping.canonical_code] = raw.original_value  # type: ignore[assignment]

        for code, value in values_by_code.items():
            if value > _SINGLE_MACRO_MAX:
                findings.append(
                    Finding(
                        check="implausible_single_macro",
                        severity="error",
                        source_record_id=record.source_record_id,
                        message=f"{code} = {value} exceeds {_SINGLE_MACRO_MAX} g per 100 g/ml basis.",
                        details={"nutrient_code": code, "value": value},
                    )
                )

        macro_sum = sum(values_by_code.get(code, 0.0) for code in _MACRO_SUM_CODES)
        if macro_sum > _MACRO_SUM_ERROR_THRESHOLD:
            findings.append(
                Finding(
                    check="implausible_macro_sum",
                    severity="error",
                    source_record_id=record.source_record_id,
                    message=(
                        "FAT+CHOAVL+PROCNT+WATER+ASH+ALC+FIBTG = "
                        f"{macro_sum:.2f} g, grossly exceeds {_MACRO_SUM_ERROR_THRESHOLD} g "
                        "per 100 g/ml basis."
                    ),
                    details={"sum": macro_sum},
                )
            )
        elif macro_sum > _MACRO_SUM_WARNING_THRESHOLD:
            findings.append(
                Finding(
                    check="implausible_macro_sum",
                    severity="warning",
                    source_record_id=record.source_record_id,
                    message=(
                        "FAT+CHOAVL+PROCNT+WATER+ASH+ALC+FIBTG = "
                        f"{macro_sum:.2f} g, exceeds {_MACRO_SUM_WARNING_THRESHOLD} g per "
                        "100 g/ml basis -- within normal analytical variance for "
                        "independently-measured macros, reported for review only."
                    ),
                    details={"sum": macro_sum},
                )
            )
    return findings


def _check_energy_consistency(records: list[PortfirSourceRecord]) -> list[Finding]:
    findings: list[Finding] = []
    for record in records:
        kcal = _value_by_code(record, "ENERC")
        kj = _value_by_code(record, "ENERC_KJ")
        if kcal is None or kj is None:
            continue
        expected_kj = kcal * _ENERGY_KJ_PER_KCAL
        if expected_kj == 0:
            if kj != 0:
                findings.append(
                    Finding(
                        check="energy_consistency",
                        severity="warning",
                        source_record_id=record.source_record_id,
                        message=f"Energia[kcal]=0 but Energia[kJ]={kj} (expected 0).",
                        details={"kcal": kcal, "kJ": kj, "expected_kJ": expected_kj},
                    )
                )
            continue
        deviation = abs(kj - expected_kj) / abs(expected_kj)
        if deviation > _ENERGY_TOLERANCE:
            findings.append(
                Finding(
                    check="energy_consistency",
                    severity="warning",
                    source_record_id=record.source_record_id,
                    message=(
                        f"Energia[kJ]={kj} deviates {deviation:.1%} from "
                        f"Energia[kcal]*{_ENERGY_KJ_PER_KCAL}={expected_kj:.1f} "
                        f"(tolerance {_ENERGY_TOLERANCE:.0%})."
                    ),
                    details={
                        "kcal": kcal,
                        "kJ": kj,
                        "expected_kJ": expected_kj,
                        "deviation": deviation,
                    },
                )
            )
    return findings


def _check_carb_fibre_sanity(records: list[PortfirSourceRecord]) -> list[Finding]:
    findings: list[Finding] = []
    for record in records:
        carb = _value_by_code(record, "CHOAVL")
        fibre = _value_by_code(record, "FIBTG")
        if carb is None or fibre is None:
            continue
        # CHOAVL is *available* carbohydrate (excludes fibre by definition),
        # so fibre exceeding it is not automatically wrong -- genuinely
        # fibrous, low-available-carb foods exist (bran, psyllium). This is
        # a soft sanity signal for human review, never a hard rule.
        if fibre > carb and fibre > _CARB_FIBRE_MIN_FIBRE:
            findings.append(
                Finding(
                    check="carb_fibre_sanity",
                    severity="warning",
                    source_record_id=record.source_record_id,
                    message=(
                        f"FIBTG={fibre} g exceeds CHOAVL={carb} g per 100 g/ml -- "
                        "check for a possible column swap or transcription error."
                    ),
                    details={"CHOAVL": carb, "FIBTG": fibre},
                )
            )
    return findings


def _check_missing_food_name(records: list[PortfirSourceRecord]) -> list[Finding]:
    findings: list[Finding] = []
    for record in records:
        if not (record.original_food_name or "").strip():
            findings.append(
                Finding(
                    check="missing_food_name",
                    severity="error",
                    source_record_id=record.source_record_id,
                    message="Nome do alimento (column B) is blank.",
                )
            )
    return findings


def _check_unknown_units(records: list[PortfirSourceRecord]) -> list[Finding]:
    findings: list[Finding] = []
    for record in records:
        for raw in record.raw_nutrients:
            if raw.original_unit not in KNOWN_UNITS:
                findings.append(
                    Finding(
                        check="unknown_unit",
                        severity="error",
                        source_record_id=record.source_record_id,
                        message=f"Unrecognised unit {raw.original_unit!r} for column {raw.source_column}.",
                        details={"unit": raw.original_unit, "column": raw.source_column},
                    )
                )
    return findings


def _check_duplicate_cod(records: list[PortfirSourceRecord]) -> list[Finding]:
    counts: dict[str, int] = {}
    for record in records:
        counts[record.source_record_id] = counts.get(record.source_record_id, 0) + 1

    findings: list[Finding] = []
    for record in records:
        count = counts[record.source_record_id]
        if count > 1:
            findings.append(
                Finding(
                    check="duplicate_cod",
                    severity="error",
                    source_record_id=record.source_record_id,
                    message=(
                        f"Cod {record.source_record_id!r} appears {count} times; "
                        "cannot determine which record is authoritative."
                    ),
                    details={"count": count},
                )
            )
    return findings


def _check_label_variants(
    records: list[PortfirSourceRecord],
    level: str,
    getter: Callable[[PortfirSourceRecord], str | None],
) -> list[Finding]:
    """Generic near-duplicate detector: groups raw labels by a whitespace
    /case/trailing-period-insensitive normalisation and flags every record
    whose group has more than one distinct raw spelling. Catches formatting
    -only "typos" (extra whitespace, case, stray punctuation).
    """
    groups: dict[str, set[str]] = {}
    for record in records:
        raw = getter(record)
        if not raw:
            continue
        groups.setdefault(_normalize_label(raw), set()).add(raw)

    variant_groups = {norm: variants for norm, variants in groups.items() if len(variants) > 1}
    if not variant_groups:
        return []

    findings: list[Finding] = []
    for record in records:
        raw = getter(record)
        if not raw:
            continue
        variants = variant_groups.get(_normalize_label(raw))
        if variants is None:
            continue
        findings.append(
            Finding(
                check=f"{level}_label_variant",
                severity="warning",
                source_record_id=record.source_record_id,
                message=(
                    f"{level} label has {len(variants)} variant spellings across "
                    f"the dataset: {sorted(variants)!r}."
                ),
                details={"variants": sorted(variants)},
            )
        )
    return findings


def _check_known_level1_variants(records: list[PortfirSourceRecord]) -> list[Finding]:
    """The Level-1 near-duplicate in BDCA v7.1-2026 is a genuine wording
    difference (not just whitespace/case), so it will not be caught by
    :func:`_check_label_variants`'s normalisation. Detected explicitly
    against the verified known pair instead.
    """
    findings: list[Finding] = []
    for group in KNOWN_LEVEL1_VARIANT_GROUPS:
        present_variants = {
            (record.foodex2_level1 or "").strip()
            for record in records
            if (record.foodex2_level1 or "").strip() in group
        }
        if len(present_variants) <= 1:
            continue
        for record in records:
            level1 = (record.foodex2_level1 or "").strip()
            if level1 in present_variants:
                findings.append(
                    Finding(
                        check="level1_known_variant",
                        severity="warning",
                        source_record_id=record.source_record_id,
                        message=(
                            f"Level-1 label {level1!r} is one of the known "
                            f"near-duplicate spellings in the BDCA export: "
                            f"{sorted(present_variants)!r}."
                        ),
                        details={"variants": sorted(present_variants)},
                    )
                )
    return findings
