"""Tests for snapshot-to-snapshot diffing: added/modified/removed
classification and never-delete deprecation of removed foods.
"""

from __future__ import annotations

import copy

from food_ingestion.portfir.diff import diff_snapshots


def _food(food_id: str, value: float, retrieved_at: str = "2026-01-01T00:00:00Z") -> dict:
    return {
        "id": food_id,
        "type": "ingredient",
        "status": "approved",
        "nutrients": [
            {
                "nutrientCode": "ENERC",
                "value": value,
                "unit": "kcal",
                "source": {"retrievedAt": retrieved_at, "sourceId": "INSA-BDCA"},
            }
        ],
    }


def test_added_removed_unchanged_classification() -> None:
    previous = [_food("pt-insa-1", 10), _food("pt-insa-2", 20)]
    current = [_food("pt-insa-1", 10), _food("pt-insa-3", 30)]

    result = diff_snapshots(previous, current)

    assert result.added == ["pt-insa-3"]
    assert result.removed == ["pt-insa-2"]
    assert result.unchanged == ["pt-insa-1"]
    assert result.modified == []


def test_modified_detects_real_content_changes() -> None:
    previous = [_food("pt-insa-1", 10)]
    current = [_food("pt-insa-1", 15)]

    result = diff_snapshots(previous, current)

    assert result.modified == ["pt-insa-1"]
    assert result.unchanged == []


def test_a_different_retrieved_at_alone_is_not_a_modification() -> None:
    previous = [_food("pt-insa-1", 10, retrieved_at="2026-01-01T00:00:00Z")]
    current = [_food("pt-insa-1", 10, retrieved_at="2026-07-16T00:00:00Z")]

    result = diff_snapshots(previous, current)

    assert result.unchanged == ["pt-insa-1"]
    assert result.modified == []


def test_removed_foods_are_never_deleted_only_deprecated() -> None:
    previous = [_food("pt-insa-1", 10), _food("pt-insa-2", 20)]
    current = [_food("pt-insa-1", 10)]

    result = diff_snapshots(previous, current)

    assert result.removed == ["pt-insa-2"]
    assert len(result.deprecated) == 1
    deprecated_food = result.deprecated[0]
    assert deprecated_food["id"] == "pt-insa-2"
    assert deprecated_food["status"] == "retired"
    # The original snapshot list is untouched.
    assert previous[1]["status"] == "approved"


def test_diff_summary_counts() -> None:
    previous = [_food("pt-insa-1", 10), _food("pt-insa-2", 20)]
    current = [_food("pt-insa-1", 15), _food("pt-insa-3", 30)]

    result = diff_snapshots(previous, current)
    assert result.summary() == {"added": 1, "modified": 1, "removed": 1, "unchanged": 0}


def test_diff_snapshots_does_not_mutate_inputs() -> None:
    previous = [_food("pt-insa-1", 10), _food("pt-insa-2", 20)]
    current = [_food("pt-insa-1", 99)]
    previous_copy = copy.deepcopy(previous)
    current_copy = copy.deepcopy(current)

    diff_snapshots(previous, current)

    assert previous == previous_copy
    assert current == current_copy
