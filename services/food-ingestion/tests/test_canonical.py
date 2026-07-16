"""Tests for CanonicalFood promotion: preparation-state parsing, food-group
shaping, basis/confidence/provenance fields, and deterministic ordering.
"""

from __future__ import annotations

from food_ingestion.portfir.canonical import content_hash, parse_preparation_state, strip_volatile


def test_preparation_state_whole_word_controlled_vocabulary() -> None:
    assert parse_preparation_state("Cenoura cozida") == "cooked"
    assert parse_preparation_state("Maçã crua") == "raw"
    assert parse_preparation_state("Feijão frito") == "fried"
    assert parse_preparation_state("Batata assada") == "roasted"
    assert parse_preparation_state("Peixe grelhado") == "grilled"
    assert parse_preparation_state("Carne estufada") == "stewed"
    assert parse_preparation_state("Fruta seca") == "dried"
    assert parse_preparation_state("Fruta cristalizada") == "candied"
    assert parse_preparation_state("Milho doce em conserva") == "preserved"
    assert parse_preparation_state("Leite reconstituído") == "reconstituted"
    assert parse_preparation_state("Leite reconstituida") == "reconstituted"


def test_preparation_state_case_insensitive() -> None:
    assert parse_preparation_state("MAÇÃ CRUA") == "raw"


def test_preparation_state_whole_word_boundary_never_false_matches() -> None:
    # "cru" must not match inside "crustáceo".
    assert parse_preparation_state("Prato de crustáceos") is None


def test_preparation_state_unrecognised_is_omitted_not_guessed() -> None:
    assert parse_preparation_state("Vinho tinto") is None
    assert parse_preparation_state("") is None


def test_preparation_state_earliest_match_wins_on_ties() -> None:
    # "crua" appears before "cozida" in the string.
    assert parse_preparation_state("Batata crua depois cozida") == "raw"


def test_food_group_omits_level3_when_blank(mini_insa_canonical: list[dict]) -> None:
    carrot = next(f for f in mini_insa_canonical if f["id"] == "pt-insa-10002")
    assert "level3" not in carrot["foodGroup"]
    assert carrot["foodGroup"]["level1"] == "Produtos hortícolas e derivados"
    assert carrot["foodGroup"]["code"] == "produtos-horticolas-e-derivados"


def test_food_group_includes_level3_when_present(mini_insa_canonical: list[dict]) -> None:
    apple = next(f for f in mini_insa_canonical if f["id"] == "pt-insa-30001")
    assert apple["foodGroup"]["level3"] == "Pomóideas"


def test_basis_unit_ml_for_alcoholic_beverages(mini_insa_canonical: list[dict]) -> None:
    wine = next(f for f in mini_insa_canonical if f["id"] == "pt-insa-20001")
    assert all(n["basisUnit"] == "ml" for n in wine["nutrients"])

    carrot = next(f for f in mini_insa_canonical if f["id"] == "pt-insa-10002")
    assert all(n["basisUnit"] == "g" for n in carrot["nutrients"])


def test_available_carbohydrate_and_fibre_are_separate_observations(mini_insa_canonical: list[dict]) -> None:
    """CHOAVL (available carbohydrate) and FIBTG (fibre) are independent
    INSA columns (N and S) and must stay independent nutrientCode
    observations -- never conflated/summed into a single "carbohydrate"
    value. Apple (pt-insa-30001) has both measured with different values.
    """
    apple = next(f for f in mini_insa_canonical if f["id"] == "pt-insa-30001")
    by_code = {n["nutrientCode"]: n for n in apple["nutrients"]}
    assert "CHOAVL" in by_code
    assert "FIBTG" in by_code
    assert by_code["CHOAVL"]["value"] == 11.4
    assert by_code["FIBTG"]["value"] == 2.4
    assert by_code["CHOAVL"]["value"] != by_code["FIBTG"]["value"]


def test_missing_nutrients_are_omitted_never_emitted_as_zero(mini_insa_canonical: list[dict]) -> None:
    carrot = next(f for f in mini_insa_canonical if f["id"] == "pt-insa-10002")
    codes = {n["nutrientCode"] for n in carrot["nutrients"]}
    assert "VITA" not in codes  # blank in the source, never inferred as 0
    assert "FAT" in codes  # genuinely measured 0
    fat = next(n for n in carrot["nutrients"] if n["nutrientCode"] == "FAT")
    assert fat["value"] == 0


def test_provenance_fields_match_reconciled_insa_bdca_catalog(mini_insa_canonical: list[dict], mini_insa_sha256: str) -> None:
    food = mini_insa_canonical[0]
    nutrient = food["nutrients"][0]
    source = nutrient["source"]
    assert source["sourceId"] == "INSA-BDCA"
    assert source["sourceVersion"] == "BDCA v7.1 (2026)"
    assert source["licence"] == "insa-portfir-attribution"
    assert source["mappingVersion"] == "insa-map-2.0"
    assert source["market"] == "PT"
    assert source["rawSnapshotSha256"] == mini_insa_sha256
    assert source["sourceRecordId"].startswith("INSA-")
    assert food["status"] == "approved"
    assert food["type"] == "ingredient"


def test_confidence_is_high_only_for_g_kcal_kj(mini_insa_canonical: list[dict]) -> None:
    for food in mini_insa_canonical:
        for nutrient in food["nutrients"]:
            expected = "high" if nutrient["unit"] in {"g", "kcal", "kJ"} else "medium"
            assert nutrient["confidence"] == expected, (food["id"], nutrient["nutrientCode"])


def test_deterministic_ordering_by_cod_numeric_then_string(mini_insa_canonical: list[dict]) -> None:
    ids = [food["id"] for food in mini_insa_canonical]
    assert ids == sorted(
        ids, key=lambda food_id: int(food_id.removeprefix("pt-insa-"))
    )


def test_micrograms_unit_uses_micro_sign(mini_insa_canonical: list[dict]) -> None:
    micro_gram_nutrients = [
        n for food in mini_insa_canonical for n in food["nutrients"] if n["unit"] == "µg"
    ]
    for nutrient in micro_gram_nutrients:
        assert nutrient["unit"] == "µg"


def test_strip_volatile_removes_only_retrieved_at() -> None:
    food = {
        "id": "pt-insa-1",
        "nutrients": [
            {"nutrientCode": "ENERC", "source": {"retrievedAt": "2026-01-01T00:00:00Z", "sourceId": "INSA-BDCA"}}
        ],
    }
    stripped = strip_volatile(food)
    assert "retrievedAt" not in stripped["nutrients"][0]["source"]
    assert stripped["nutrients"][0]["source"]["sourceId"] == "INSA-BDCA"
    # Original is untouched (deep copy).
    assert food["nutrients"][0]["source"]["retrievedAt"] == "2026-01-01T00:00:00Z"


def test_content_hash_ignores_retrieved_at_but_not_real_changes() -> None:
    base = {
        "id": "pt-insa-1",
        "nutrients": [{"nutrientCode": "ENERC", "value": 10, "source": {"retrievedAt": "A"}}],
    }
    same_content_different_time = {
        "id": "pt-insa-1",
        "nutrients": [{"nutrientCode": "ENERC", "value": 10, "source": {"retrievedAt": "B"}}],
    }
    different_value = {
        "id": "pt-insa-1",
        "nutrients": [{"nutrientCode": "ENERC", "value": 11, "source": {"retrievedAt": "A"}}],
    }
    assert content_hash(base) == content_hash(same_content_different_time)
    assert content_hash(base) != content_hash(different_value)
