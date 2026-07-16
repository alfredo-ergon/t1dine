"""Build CanonicalFood dicts (the T1Dine `@t1dine/food-schema` contract) from
parsed PortFIR staging records.

Records that pass quality checks (see :mod:`food_ingestion.portfir.quality`)
are promoted straight to ``status: "approved"`` under the reconciled
``INSA-BDCA`` provenance already used by the existing catalog (see
``services/api/src/catalogData/insaBuilder.ts`` and
``docs/data/insa_attribution.md``); this adapter's output is deliberately
aligned with that pipeline rather than introducing a second, divergent
provenance for the same underlying dataset. Quarantined records never reach
this module at all -- callers are responsible for filtering them out first.
"""

from __future__ import annotations

import copy
import hashlib
import json
import re
import unicodedata
from typing import Any

from . import nutrient_map as nm
from .parser import PortfirSourceRecord

# --------------------------------------------------------------------------
# Preparation-state parsing: a fixed, whole-word, case-insensitive controlled
# vocabulary. Unrecognised terms are never guessed -- the field is simply
# omitted and the full original name is always kept intact regardless.
# --------------------------------------------------------------------------

_PREPARATION_VOCAB: tuple[tuple[str, str], ...] = (
    ("cru|crua", "raw"),
    ("cozido|cozida", "cooked"),
    ("assado|assada", "roasted"),
    ("frito|frita", "fried"),
    ("grelhado|grelhada", "grilled"),
    ("estufado|estufada", "stewed"),
    ("seco|seca", "dried"),
    ("cristalizado|cristalizada", "candied"),
    ("em conserva", "preserved"),
    ("reconstituído|reconstituida", "reconstituted"),
)

_PREPARATION_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = tuple(
    (re.compile(rf"\b(?:{alternatives})\b", re.IGNORECASE), state)
    for alternatives, state in _PREPARATION_VOCAB
)


def parse_preparation_state(name: str) -> str | None:
    """Match the controlled preparation-state vocabulary against a food name.

    Whole-word, case-insensitive. When several terms appear, the one
    starting earliest in the name wins (ties broken by vocabulary order).
    Returns ``None`` (never guess) when nothing recognised is found.
    """
    best: tuple[int, str] | None = None
    for pattern, state in _PREPARATION_PATTERNS:
        match = pattern.search(name or "")
        if match and (best is None or match.start() < best[0]):
            best = (match.start(), state)
    return best[1] if best else None


def _slugify(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    without_marks = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    slug = re.sub(r"[^a-z0-9]+", "-", without_marks.lower()).strip("-")
    return slug


def _build_food_group(record: PortfirSourceRecord) -> dict[str, Any]:
    level1 = (record.foodex2_level1 or "").strip()
    level2 = (record.foodex2_level2 or "").strip()
    food_group: dict[str, Any] = {
        "level1": level1,
        "level2": level2,
        "code": _slugify(level1),
    }
    level3_raw = record.foodex2_level3
    if level3_raw is not None and str(level3_raw).strip():
        food_group["level3"] = str(level3_raw).strip()
    return food_group


def _build_source_reference(record: PortfirSourceRecord, sha256: str, now: str) -> dict[str, Any]:
    return {
        "sourceId": nm.CANONICAL_SOURCE_ID,
        "sourceRecordId": f"INSA-{record.source_record_id}",
        "sourceVersion": nm.CANONICAL_SOURCE_VERSION,
        "market": "PT",
        "licence": nm.CANONICAL_LICENCE,
        "attribution": nm.ATTRIBUTION,
        "retrievedAt": now,
        "rawSnapshotSha256": sha256,
        "mappingVersion": nm.CANONICAL_MAPPING_VERSION,
    }


def _build_nutrient_observations(
    record: PortfirSourceRecord, source_reference: dict[str, Any]
) -> list[dict[str, Any]]:
    basis_unit = "ml" if record.basis == "ml" else "g"
    observations: list[dict[str, Any]] = []
    for raw in record.raw_nutrients:
        if raw.value_state != "MEASURED":
            # MISSING nutrients are omitted entirely -- never emitted as 0.
            continue
        mapping = nm.map_for_column(raw.source_column)
        observations.append(
            {
                "nutrientCode": mapping.canonical_code,
                "value": raw.original_value,
                "unit": mapping.canonical_unit,
                "basisQuantity": 100,
                "basisUnit": basis_unit,
                "method": "analytical",
                "confidence": mapping.confidence,
                "source": source_reference,
            }
        )
    return observations


def _build_food(record: PortfirSourceRecord, sha256: str, now: str) -> dict[str, Any]:
    source_reference = _build_source_reference(record, sha256, now)
    food: dict[str, Any] = {
        "id": f"pt-insa-{record.source_record_id}",
        "type": "ingredient",
        "names": [
            {
                "language": "pt-PT",
                "name": record.original_food_name,
                "synonyms": [],
            }
        ],
        "countries": ["PT"],
        "markets": ["PT"],
        "barcodes": [],
        "cuisineTags": [],
        "dietaryPatternTags": [],
        "mealContextTags": [],
        "clinicalBehaviourTags": [],
        "nutrients": _build_nutrient_observations(record, source_reference),
        "status": nm.CANONICAL_STATUS,
    }
    preparation_state = parse_preparation_state(record.original_food_name)
    if preparation_state is not None:
        food["preparationState"] = preparation_state
    food["foodGroup"] = _build_food_group(record)
    return food


def _sort_key(food: dict[str, Any]) -> tuple[int, int, str]:
    """Deterministic ordering: numeric Cod first (sorted numerically), then
    any non-numeric Cod (sorted as a string).
    """
    cod = str(food["id"]).removeprefix("pt-insa-")
    if cod.isdigit():
        return (0, int(cod), cod)
    return (1, 0, cod)


def to_canonical(records: list[PortfirSourceRecord], sha: str, now: str) -> list[dict[str, Any]]:
    """Build CanonicalFood dicts for already-filtered (non-quarantined)
    records, deterministically ordered by Cod (numeric, then string).

    Same input records + same `sha` + same `now` always produces the same
    JSON, byte for byte -- no time/random-based values are introduced here.
    """
    foods = [_build_food(record, sha, now) for record in records]
    foods.sort(key=_sort_key)
    return foods


# --------------------------------------------------------------------------
# Determinism helpers: `import_timestamp` (here: `source.retrievedAt`) must
# stay out of any equality/hash comparison of the canonical records, so a
# rerun with a different `--now` is still recognised as "unchanged content"
# by diff.py and by the idempotency tests.
# --------------------------------------------------------------------------

_VOLATILE_SOURCE_KEYS: tuple[str, ...] = ("retrievedAt",)


def strip_volatile(food: dict[str, Any]) -> dict[str, Any]:
    """Deep copy of `food` with volatile, run-specific fields removed."""
    clone = copy.deepcopy(food)
    for nutrient in clone.get("nutrients", []):
        source = nutrient.get("source")
        if isinstance(source, dict):
            for key in _VOLATILE_SOURCE_KEYS:
                source.pop(key, None)
    return clone


def content_hash(food: dict[str, Any]) -> str:
    """Stable SHA-256 over a food's content, excluding volatile fields."""
    stripped = strip_volatile(food)
    encoded = json.dumps(stripped, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()
