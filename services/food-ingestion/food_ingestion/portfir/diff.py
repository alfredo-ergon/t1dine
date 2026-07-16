"""Diff two canonical PortFIR NDJSON snapshots by food ``id``.

Also runnable as ``python -m food_ingestion.portfir.diff --previous <path>
--current <path>``.

Removed foods are never deleted -- they are reclassified as deprecated
(``status: "retired"``) so historical meal evidence referencing them is
never silently invalidated (candidate promotion / retirement must stay
auditable; see docs/data/food-data-strategy.md "Governance").
"""

from __future__ import annotations

import argparse
import copy
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .canonical import content_hash
from .reporting import read_ndjson, write_json


@dataclass(frozen=True)
class DiffResult:
    added: list[str]
    modified: list[str]
    removed: list[str]
    unchanged: list[str]
    deprecated: list[dict[str, Any]] = field(default_factory=list)

    def summary(self) -> dict[str, int]:
        return {
            "added": len(self.added),
            "modified": len(self.modified),
            "removed": len(self.removed),
            "unchanged": len(self.unchanged),
        }


def _index_by_id(foods: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {food["id"]: food for food in foods}


def _deprecate(food: dict[str, Any]) -> dict[str, Any]:
    """A removed food is never deleted -- return a deep copy with status
    "retired" instead, safe to write out (e.g. to a deprecations NDJSON)
    without mutating the original snapshot object.
    """
    deprecated = copy.deepcopy(food)
    deprecated["status"] = "retired"
    return deprecated


def diff_snapshots(
    previous_json: list[dict[str, Any]], current_records: list[dict[str, Any]]
) -> DiffResult:
    """Classify every food id present in either snapshot as added, modified,
    removed, or unchanged, keyed by ``id`` (``pt-insa-<Cod>``).

    Comparison ignores volatile, run-specific fields (currently
    ``nutrients[].source.retrievedAt``, i.e. the ``--now``-derived field) so
    rerunning an import with a different ``--now`` and otherwise-identical
    data is never reported as "modified" -- see
    :func:`food_ingestion.portfir.canonical.content_hash`.
    """
    previous_index = _index_by_id(previous_json)
    current_index = _index_by_id(current_records)

    previous_ids = set(previous_index)
    current_ids = set(current_index)

    added = sorted(current_ids - previous_ids)
    removed = sorted(previous_ids - current_ids)
    shared = previous_ids & current_ids

    modified: list[str] = []
    unchanged: list[str] = []
    for food_id in sorted(shared):
        if content_hash(previous_index[food_id]) == content_hash(current_index[food_id]):
            unchanged.append(food_id)
        else:
            modified.append(food_id)

    deprecated = [_deprecate(previous_index[food_id]) for food_id in removed]

    return DiffResult(
        added=added, modified=modified, removed=removed, unchanged=unchanged, deprecated=deprecated
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m food_ingestion.portfir.diff",
        description="Diff two canonical PortFIR NDJSON snapshots by food id.",
    )
    parser.add_argument("--previous", required=True, help="Path to the previous canonical NDJSON snapshot.")
    parser.add_argument("--current", required=True, help="Path to the current canonical NDJSON snapshot.")
    parser.add_argument("--output", default=None, help="Directory to write diff-report.json into (optional).")
    args = parser.parse_args(argv)

    previous = read_ndjson(args.previous)
    current = read_ndjson(args.current)
    result = diff_snapshots(previous, current)

    report = {
        "summary": result.summary(),
        "added": result.added,
        "modified": result.modified,
        "removed": result.removed,
        "unchanged": result.unchanged,
        "deprecated": result.deprecated,
    }

    print(f"PortFIR diff: {result.summary()}")

    if args.output:
        path = write_json(report, Path(args.output) / "diff-report.json")
        print(f"Wrote diff report to {path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
