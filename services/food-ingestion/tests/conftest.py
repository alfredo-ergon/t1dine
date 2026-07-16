"""Shared pytest fixtures for the PortFIR adapter test suite."""

from __future__ import annotations

from pathlib import Path

import pytest

from food_ingestion.portfir.canonical import to_canonical
from food_ingestion.portfir.parser import PortfirSourceRecord, parse_records, sha256_file
from food_ingestion.portfir.quality import QualityReport, run_quality_checks

from .fixtures.make_mini_insa import FIXTURE_PATH, build_workbook

# Fixed so every test run is byte-for-byte reproducible -- matches
# nutrient_map.DEFAULT_NOW, the fallback used when `--now` is omitted.
FIXED_NOW = "1970-01-01T00:00:00Z"


@pytest.fixture(scope="session", autouse=True)
def _ensure_mini_insa_fixture() -> Path:
    """`tests/fixtures/mini_insa.xlsx` is committed as the fixture of
    record; regenerate it on the fly if it is ever missing so the suite is
    self-healing (e.g. a fresh checkout that skipped binary files).
    """
    if not FIXTURE_PATH.exists():
        FIXTURE_PATH.parent.mkdir(parents=True, exist_ok=True)
        build_workbook().save(FIXTURE_PATH)
    return FIXTURE_PATH


@pytest.fixture
def mini_insa_path(_ensure_mini_insa_fixture: Path) -> Path:
    return _ensure_mini_insa_fixture


@pytest.fixture
def mini_insa_sha256(mini_insa_path: Path) -> str:
    return sha256_file(mini_insa_path)


@pytest.fixture
def mini_insa_records(mini_insa_path: Path) -> list[PortfirSourceRecord]:
    return parse_records(mini_insa_path, now=FIXED_NOW)


@pytest.fixture
def mini_insa_quality_report(mini_insa_records: list[PortfirSourceRecord]) -> QualityReport:
    return run_quality_checks(mini_insa_records)


@pytest.fixture
def mini_insa_canonical(
    mini_insa_records: list[PortfirSourceRecord],
    mini_insa_quality_report: QualityReport,
    mini_insa_sha256: str,
) -> list[dict]:
    clean = mini_insa_quality_report.clean_records(mini_insa_records)
    return to_canonical(clean, mini_insa_sha256, FIXED_NOW)
