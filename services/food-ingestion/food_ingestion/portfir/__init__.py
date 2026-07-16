"""PortFIR (INSA BDCA v7.1-2026) adapter: the first concrete source adapter
for :mod:`food_ingestion`.

Stdlib + ``openpyxl`` only. Deterministic and idempotent: the same workbook
(same SHA-256) always produces byte-identical canonical output for a given
``--now``. Never mutates or infers values into the source workbook; never
infers a missing nutrient value as zero; never silently "fixes" suspicious
data (quarantines it and reports why instead).

Pipeline: :mod:`profiler` (read-only structural profile) ->
:mod:`parser` (fail-closed structural parse into immutable staging records)
-> :mod:`quality` (findings + quarantine classification) ->
:mod:`canonical` (CanonicalFood promotion for quality-clean records) ->
:mod:`reporting` (NDJSON + validation-report writers, immutable snapshot
copy) -> :mod:`diff` (snapshot-to-snapshot comparison, never-delete
deprecation).
"""

from .canonical import content_hash, parse_preparation_state, strip_volatile, to_canonical
from .diff import DiffResult, diff_snapshots
from .nutrient_map import (
    DECLARED_BUT_ABSENT,
    NUTRIENT_MAP,
    NutrientMapping,
    UnmappedColumnError,
    map_for_column,
)
from .parser import (
    PortfirSourceRecord,
    RawNutrientValue,
    WorkbookStructureError,
    parse_records,
    sha256_file,
)
from .profiler import profile_workbook
from .quality import Finding, QualityReport, run_quality_checks

__all__ = [
    "content_hash",
    "parse_preparation_state",
    "strip_volatile",
    "to_canonical",
    "DiffResult",
    "diff_snapshots",
    "DECLARED_BUT_ABSENT",
    "NUTRIENT_MAP",
    "NutrientMapping",
    "UnmappedColumnError",
    "map_for_column",
    "PortfirSourceRecord",
    "RawNutrientValue",
    "WorkbookStructureError",
    "parse_records",
    "sha256_file",
    "profile_workbook",
    "Finding",
    "QualityReport",
    "run_quality_checks",
]
