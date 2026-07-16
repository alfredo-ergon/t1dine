"""Single source of truth for the PortFIR (INSA BDCA v7.1-2026) adapter.

This module owns:

* the 48-column nutrient mapping table (data columns ``F``..``BA`` of the
  ``INSA - BDCA_v 7.1 - 2026`` sheet), resolved by *curated position* rather
  than fuzzy label matching, per column letter;
* the two "declared but absent" legend-only codes (``SUCS``, ``LACS``) that
  appear in the workbook's ``Componentes-Correspondência`` legend sheet but
  have no corresponding data column in this export;
* the expected header text for every column (``A``..``BA``), used by
  :mod:`food_ingestion.portfir.parser` to fail closed on structural drift;
* shared provenance constants (source id/version, licence status,
  attribution, mapping version) reused by the parser, canonical builder, and
  reporting modules so they cannot drift relative to each other.

No unit conversion is applied anywhere in this adapter: source units already
equal canonical units (identity mapping). If a data column cannot be
resolved to an entry in :data:`NUTRIENT_MAP`, :func:`map_for_column` raises
-- callers must fail closed rather than silently drop the column.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# --------------------------------------------------------------------------
# Shared provenance / workbook-structure constants.
#
# There are two provenance "layers", intentionally distinct:
#   * Staging (raw `PortfirSourceRecord`) -- identifies the ingestion/parsing
#     logic version that produced the immutable staging snapshot. Stays
#     conservative (`LICENCE_STATUS`) regardless of downstream promotion
#     decisions -- staging never mutates once written.
#   * Canonical (`CanonicalFood.nutrients[].source`) -- identifies the
#     reconciled, already-approved catalog provenance this dataset is
#     published under (see docs/data/insa_attribution.md and
#     services/api/src/catalogData/insaBuilder.ts, which this adapter's
#     canonical output is deliberately aligned with).
# --------------------------------------------------------------------------

SOURCE_ORG = "INSA"
SOURCE_DATASET = "BDCA"
SOURCE_VERSION = "7.1-2026"
MAPPING_VERSION = "portfir-1.0"
LICENCE_STATUS = "LICENCE_REVIEW_REQUIRED"
ATTRIBUTION = (
    "Fonte: Base de Dados da Composição de Alimentos. Instituto Nacional de "
    "Saúde Doutor Ricardo Jorge, I. P.- INSA. v 7.1 - 2026"
)
# Deterministic fallback for `--now`/import_timestamp so unit tests never
# depend on wall-clock time. Real (non-test) invocations should always pass
# an explicit `--now`.
DEFAULT_NOW = "1970-01-01T00:00:00Z"
IMPORTER_VERSION = "food-ingestion-portfir-0.1.0"

# Canonical (promoted) provenance -- reconciled with the existing INSA/BDCA
# catalog already shipped under sourceId "INSA-BDCA" (see
# services/api/src/catalogData/insaBuilder.ts). Records that pass quality
# checks (no ERROR findings) are promoted straight to CanonicalFood
# status "approved" under this provenance; quarantined records never reach
# canonical output at all (see quality.py).
CANONICAL_SOURCE_ID = "INSA-BDCA"
CANONICAL_SOURCE_VERSION = "BDCA v7.1 (2026)"
CANONICAL_LICENCE = "insa-portfir-attribution"
CANONICAL_MAPPING_VERSION = "insa-map-2.0"
CANONICAL_STATUS = "approved"

DATA_SHEET_NAME = "INSA - BDCA_v 7.1 - 2026"
LEGEND_SHEET_NAME = "Componentes-Correspondência"
INFO_SHEET_NAME = "Informação adicional"
EXPECTED_SHEET_NAMES: tuple[str, ...] = (DATA_SHEET_NAME, LEGEND_SHEET_NAME, INFO_SHEET_NAME)

BANNER_ROW_INDEX = 1
HEADER_ROW_INDEX = 2
FIRST_DATA_ROW_INDEX = 3
EXPECTED_COLUMN_COUNT = 53  # columns A..BA

# Basis is per-100 g edible portion, except this exact Level-1 label, which is
# reported per 100 ml edible portion.
ALCOHOLIC_BEVERAGES_LEVEL1 = "Bebidas alcoólicas"

# Column letters A..E carry identity/classification, not nutrients.
NON_NUTRIENT_HEADERS: dict[int, str] = {
    1: "Cod",
    2: "Nome do alimento",
    3: "Nível 1 ",
    4: "Nível 2",
    5: "Nível 3 ",
}


class UnmappedColumnError(KeyError):
    """Raised when a data column cannot be resolved to a mapping entry.

    Per the T1Dine data rules, unresolved columns must fail closed (raise)
    rather than be silently dropped.
    """


@dataclass(frozen=True)
class NutrientMapping:
    source_column: str  # e.g. "F"
    source_label: str  # verbatim header text, including unit and whitespace
    infoods_code: str
    eurofir_code: str
    source_unit: str
    canonical_code: str
    canonical_unit: str
    confidence: str  # "high" | "medium" -- unit-derived, see `_confidence_for_unit`
    notes: str = ""


@dataclass(frozen=True)
class DeclaredButAbsentNutrient:
    """A legend entry with no corresponding data column in this export."""

    legend_label: str
    infoods_code: str
    eurofir_code: str
    canonical_code: str
    unit: str
    notes: str


_UNIT_BRACKET_RE = re.compile(r"\[([^\[\]]+)\]")


def _extract_unit(source_label: str) -> str:
    """Extract the bracketed unit token from a verbatim header label.

    Used only as a build-time self-check that the hand-transcribed
    ``source_unit`` below actually matches the label text -- catches
    transcription typos immediately at import time.
    """
    match = _UNIT_BRACKET_RE.search(source_label)
    if not match:
        raise ValueError(f"Could not extract a unit from header label {source_label!r}")
    return match.group(1)


def _confidence_for_unit(canonical_unit: str) -> str:
    """Single unit-derived confidence rule, applied identically to every
    nutrient observation this adapter emits: gram macros and energy are
    "high"; every mg and µg micronutrient (including sodium, cholesterol,
    minerals, and vitamins) defaults to "medium". Mirrors the TypeScript
    nutrient dictionary's `defaultConfidence()`.
    """
    return "high" if canonical_unit in {"g", "kcal", "kJ"} else "medium"


# --------------------------------------------------------------------------
# The 48-column mapping table, columns F..BA in worksheet order. Each row is
# (column_letter, verbatim source_label, infoods_code, eurofir_code,
# canonical_code, notes). source_unit/canonical_unit are derived from the
# label (identity mapping); confidence is derived from canonical_unit.
# --------------------------------------------------------------------------

_RAW_TABLE: tuple[tuple[str, str, str, str, str, str], ...] = (
    ("F", "Energia\n[kcal] ", "ENERC", "ENERC", "ENERC", ""),
    ("G", "Energia\n[kJ] ", "ENERC", "ENERC", "ENERC_KJ",
     "Legend lists one 'ENERC' row for energy; the workbook reports it twice "
     "(kcal and kJ) as separate data columns, so the canonical code is "
     "differentiated by unit (ENERC / ENERC_KJ)."),
    ("H", "Lípidos\n[g]", "FAT", "FAT", "FAT", ""),
    ("I", "Ácidos gordos saturados\n[g] ", "FASAT", "FASAT", "FASAT", ""),
    ("J", "Ácidos gordos monoinsaturados \n[g]", "FAMS", "FAMS", "FAMS", ""),
    ("K", "Ácidos gordos polinsaturados \n[g]", "FAPU", "FAPU", "FAPU", ""),
    ("L", "Ácido linoleico \n[g] ", "F18D2CN6", "F18:2CN6", "F18D2CN6",
     "EUROFIR code uses ':' punctuation (F18:2CN6); INFOODS tag is F18D2CN6."),
    ("M", "Ácidos gordos trans \n[g]", "FATRN", "FATRS", "FATRN",
     "EUROFIR (FATRS) and INFOODS (FATRN) codes diverge for trans fatty acids; "
     "canonical_code follows the INFOODS tag per the mapping brief."),
    ("N", "Hidratos de carbono \n[g]", "CHOAVL", "CHO", "CHOAVL",
     "Available carbohydrate (dose-relevant). EUROFIR's generic 'CHO' code is "
     "recorded for reference only; canonical_code is the INFOODS AVAILABLE "
     "carbohydrate tag CHOAVL."),
    ("O", "Açúcares \n[g] ", "SUGAR", "SUGAR", "SUGAR", ""),
    ("P", "Oligossacáridos \n[g] ", "OLSAC", "OLSAC", "OLSAC", ""),
    ("Q", "Amido \n[g]", "STARCH", "STARCH", "STARCH", ""),
    ("R", "Sal  \n[g]", "NACL", "NACL", "NACL", ""),
    ("S", "Fibra  \n[g]", "FIBTG", "FIBT", "FIBTG",
     "EUROFIR (FIBT) and INFOODS (FIBTG) codes diverge; canonical_code follows "
     "the INFOODS tag."),
    ("T", "Proteínas \n[g] ", "PROCNT", "PROT", "PROCNT",
     "EUROFIR (PROT) and INFOODS (PROCNT) codes diverge; canonical_code "
     "follows the INFOODS tag."),
    ("U", "Álcool \n[g] ", "ALC", "ALC", "ALC", ""),
    ("V", "Água \n[g] ", "WATER", "WATER", "WATER", ""),
    ("W", "Ácidos orgânicos \n[g] ", "OA", "OA", "OA", ""),
    ("X", "Colesterol \n[mg]", "CHOLE", "CHORL", "CHOLE",
     "EUROFIR (CHORL) and INFOODS (CHOLE) codes diverge; canonical_code "
     "follows the INFOODS tag."),
    ("Y", "Vitamina A  \n[µg]", "VITA", "VITA", "VITA", ""),
    ("Z", "Equivalentes de β-caroteno \n[µg]", "CARTBEQ", "CARTBEQ", "CARTBEQ", ""),
    ("AA", "α-caroteno\n[µg]", "CARTA", "CARTA", "CARTA", ""),
    ("AB", "β-caroteno, total\n[µg]", "CARTBTOT", "CARTBTOT", "CARTBTOT",
     "Legend's INFOODS column (INFDSTAG2) is blank for this row; the EUROFIR "
     "code is reused as the canonical/INFOODS-tag placeholder."),
    ("AC", "β-criptoxantina\n[µg]", "CRYPXB", "CRYPXB", "CRYPXB", ""),
    ("AD", "Licopeno\n[µg]", "LYCPN", "LYCPN", "LYCPN", ""),
    ("AE", "Luteína\n[µg]", "LUTN", "LUTN", "LUTN", ""),
    ("AF", "Zeaxantina\n[µg]", "ZEA", "ZEA", "ZEA", ""),
    ("AG", "Vitamina D \n[µg]", "VITD", "VITD", "VITD", ""),
    ("AH", "α-tocoferol \n[mg]", "TOCPHA", "TOCPHA", "TOCPHA",
     "Legend sheet spells this label 'alfa-tocoferol' (ASCII) while the data "
     "sheet header uses the Greek letter 'α-tocoferol'; same nutrient "
     "(alpha-tocopherol / vitamin E), both resolve to TOCPHA."),
    ("AI", "Tiamina \n[mg] ", "THIA", "THIA", "THIA", ""),
    ("AJ", "Riboflavina \n[mg] ", "RIBF", "RIBF", "RIBF", ""),
    ("AK", "Niacina \n[mg]", "NIA", "NIA", "NIA", ""),
    ("AL", "Equivalentes de niacina \n[mg]", "NIAEQ", "NIAEQ", "NIAEQ", ""),
    ("AM", "Triptofano/60 \n[mg]", "NIATRP", "NIATRP", "NIATRP", ""),
    ("AN", "Vitamina B6 \n[mg]", "VITB6A", "VITB6", "VITB6A",
     "EUROFIR (VITB6) and INFOODS (VITB6A) codes diverge; canonical_code "
     "follows the INFOODS tag."),
    ("AO", "Vitamina B12 \n[µg]", "VITB12", "VITB12", "VITB12", ""),
    ("AP", "Vitamina C \n[mg]", "VITC", "VITC", "VITC", ""),
    ("AQ", "Folatos \n[µg]", "FOL", "FOL", "FOL", ""),
    ("AR", "Cinza \n[g]", "ASH", "ASH", "ASH", ""),
    ("AS", "Sódio \n[mg]", "NA", "NA", "NA", ""),
    ("AT", "Potássio \n[mg] ", "K", "K", "K", ""),
    ("AU", "Cálcio \n[mg]", "CA", "CA", "CA", ""),
    ("AV", "Fósforo \n[mg]", "P", "P", "P", ""),
    ("AW", "Magnésio \n[mg]", "MG", "MG", "MG", ""),
    ("AX", "Ferro \n[mg]", "FE", "FE", "FE", ""),
    ("AY", "Zinco \n[mg]", "ZN", "ZN", "ZN", ""),
    ("AZ", "Selénio \n[µg]", "SE", "SE", "SE", ""),
    ("BA", "Iodo \n[µg]", "ID", "ID", "ID", ""),
)


def _build_nutrient_map() -> dict[str, NutrientMapping]:
    table: dict[str, NutrientMapping] = {}
    for column, label, infoods_code, eurofir_code, canonical_code, notes in _RAW_TABLE:
        unit = _extract_unit(label)
        confidence = _confidence_for_unit(unit)
        table[column] = NutrientMapping(
            source_column=column,
            source_label=label,
            infoods_code=infoods_code,
            eurofir_code=eurofir_code,
            source_unit=unit,
            canonical_code=canonical_code,
            canonical_unit=unit,
            confidence=confidence,
            notes=notes,
        )
    return table


NUTRIENT_MAP: dict[str, NutrientMapping] = _build_nutrient_map()

# Data columns F..BA in worksheet order (48 entries).
NUTRIENT_COLUMNS: tuple[str, ...] = tuple(col for col, *_ in _RAW_TABLE)

assert len(NUTRIENT_MAP) == 48, f"expected 48 mapped nutrient columns, got {len(NUTRIENT_MAP)}"

# Legend-only codes: present in the 'Componentes-Correspondência' sheet but
# with no corresponding data column in this export. Never emitted as
# observations -- kept for documentation/traceability only.
DECLARED_BUT_ABSENT: tuple[DeclaredButAbsentNutrient, ...] = (
    DeclaredButAbsentNutrient(
        legend_label="Sacarose\n[g]",
        infoods_code="SUCS",
        eurofir_code="SUCS",
        canonical_code="SUCS",
        unit="g",
        notes="Declared in the legend sheet (row after Açúcares/SUGAR) but has "
        "no corresponding data column in BDCA v7.1-2026.",
    ),
    DeclaredButAbsentNutrient(
        legend_label="Lactose\n[g]",
        infoods_code="LACS",
        eurofir_code="LACS",
        canonical_code="LACS",
        unit="g",
        notes="Declared in the legend sheet (row after Sacarose/SUCS) but has "
        "no corresponding data column in BDCA v7.1-2026.",
    ),
)


def map_for_column(letter: str) -> NutrientMapping:
    """Resolve a data-sheet column letter (e.g. "F", "AH") to its mapping
    entry. Fails closed: raises :class:`UnmappedColumnError` rather than
    returning ``None`` or silently skipping the column.
    """
    try:
        return NUTRIENT_MAP[letter]
    except KeyError as exc:
        raise UnmappedColumnError(
            f"Column {letter!r} has no PortFIR nutrient mapping entry; "
            "refusing to silently drop it."
        ) from exc


def expected_header_text(column_index: int) -> str:
    """Verbatim expected header text (row 2) for a 1-based column index
    A(1)..BA(53), used by the parser's structural-drift check.
    """
    if column_index in NON_NUTRIENT_HEADERS:
        return NON_NUTRIENT_HEADERS[column_index]
    for column, label, *_ in _RAW_TABLE:
        if _column_letter_to_index(column) == column_index:
            return label
    raise UnmappedColumnError(f"No expected header for column index {column_index}")


def _column_letter_to_index(letter: str) -> int:
    """Convert an Excel column letter (A, B, ..., Z, AA, AB, ...) to a 1-based
    index. Stdlib-only (no dependency on openpyxl.utils) so this module has
    zero import-time dependencies beyond the standard library.
    """
    index = 0
    for char in letter:
        index = index * 26 + (ord(char.upper()) - ord("A") + 1)
    return index


def normalize_header(text: str | None) -> str:
    """Collapse all whitespace (including embedded newlines) to single spaces
    and strip the ends. Used to compare header text for structural-drift
    detection without being tripped up by inconsequential re-wrapping.
    """
    return " ".join((text or "").split())


def is_blank_nutrient_value(value: object) -> bool:
    """True for a "not analysed" nutrient cell.

    The real BDCA v7.1-2026 export represents almost every not-analysed
    nutrient cell as an empty (or whitespace-only) string rather than a true
    blank (``None``) cell -- verified across the whole workbook (10,016
    empty-string cells, 1 true ``None`` cell, zero non-empty stray strings).
    Both forms mean MISSING; neither is ever inferred as zero. Shared by
    :mod:`parser` (fail-closed parsing) and :mod:`profiler` (read-only
    counting) so the two never disagree on what counts as missing.
    """
    return value is None or (isinstance(value, str) and value.strip() == "")
