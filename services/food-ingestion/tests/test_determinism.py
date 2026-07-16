"""Determinism and idempotency: same workbook bytes (+ same `--now`) must
produce byte-identical canonical output; a different `--now` alone must
never register as a content change.
"""

from __future__ import annotations

import json
from pathlib import Path

from food_ingestion.portfir.canonical import content_hash, to_canonical
from food_ingestion.portfir.parser import parse_records, sha256_file
from food_ingestion.portfir.profiler import profile_workbook
from food_ingestion.portfir.quality import run_quality_checks
from food_ingestion.portfir.reporting import write_ndjson, write_raw_ndjson


def _run_pipeline(path: Path, now: str) -> list[dict]:
    records = parse_records(path, now=now)
    sha = sha256_file(path)
    report = run_quality_checks(records)
    clean = report.clean_records(records)
    return to_canonical(clean, sha, now)


def test_same_bytes_same_now_produces_byte_identical_canonical_json(mini_insa_path: Path, tmp_path: Path) -> None:
    now = "2026-07-16T00:00:00Z"
    foods_a = _run_pipeline(mini_insa_path, now)
    foods_b = _run_pipeline(mini_insa_path, now)

    path_a = write_ndjson(foods_a, tmp_path / "a.ndjson")
    path_b = write_ndjson(foods_b, tmp_path / "b.ndjson")

    assert path_a.read_bytes() == path_b.read_bytes()


def test_raw_staging_ndjson_is_byte_identical_on_rerun(mini_insa_path: Path, tmp_path: Path) -> None:
    now = "2026-07-16T00:00:00Z"
    records_a = parse_records(mini_insa_path, now=now)
    records_b = parse_records(mini_insa_path, now=now)

    path_a = write_raw_ndjson(records_a, tmp_path / "raw-a.ndjson")
    path_b = write_raw_ndjson(records_b, tmp_path / "raw-b.ndjson")

    assert path_a.read_bytes() == path_b.read_bytes()


def test_different_now_changes_retrieved_at_but_not_content_hash(mini_insa_path: Path) -> None:
    foods_a = _run_pipeline(mini_insa_path, "2026-01-01T00:00:00Z")
    foods_b = _run_pipeline(mini_insa_path, "2026-12-31T00:00:00Z")

    ids_a = {food["id"]: food for food in foods_a}
    ids_b = {food["id"]: food for food in foods_b}
    assert set(ids_a) == set(ids_b)

    for food_id in ids_a:
        assert content_hash(ids_a[food_id]) == content_hash(ids_b[food_id])
        # But the raw JSON does differ (retrievedAt changed) -- proving the
        # hash equality above is a real assertion, not a no-op.
        assert ids_a[food_id]["nutrients"][0]["source"]["retrievedAt"] == "2026-01-01T00:00:00Z"
        assert ids_b[food_id]["nutrients"][0]["source"]["retrievedAt"] == "2026-12-31T00:00:00Z"
        assert json.dumps(ids_a[food_id], sort_keys=True) != json.dumps(ids_b[food_id], sort_keys=True)


def test_default_now_constant_is_deterministic_across_runs(mini_insa_path: Path) -> None:
    foods_a = _run_pipeline(mini_insa_path, "1970-01-01T00:00:00Z")
    foods_b = _run_pipeline(mini_insa_path, "1970-01-01T00:00:00Z")
    assert json.dumps(foods_a, sort_keys=True) == json.dumps(foods_b, sort_keys=True)


def test_profile_workbook_is_deterministic(mini_insa_path: Path) -> None:
    report_a = profile_workbook(mini_insa_path)
    report_b = profile_workbook(mini_insa_path)
    assert json.dumps(report_a, sort_keys=True) == json.dumps(report_b, sort_keys=True)
