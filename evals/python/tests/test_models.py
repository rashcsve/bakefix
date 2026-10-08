import re
from pathlib import Path

import pytest
from pydantic import BaseModel, ValidationError

from bakefix_evals.models import (
    DIETARY_CONSTRAINTS,
    PASTRY_CATEGORIES,
    Diagnosis,
    DiagnosisInput,
)

LIB = Path(__file__).resolve().parents[3] / "lib"
CONSTANTS_TS = LIB / "constants.ts"
SCHEMA_TS = LIB / "ai" / "schema.ts"


def _ts_array(name: str) -> tuple[str, ...]:
    source = CONSTANTS_TS.read_text()
    match = re.search(rf"export const {name} = \[(.*?)\] as const", source, re.S)
    assert match, f"{name} not found in {CONSTANTS_TS}"
    return tuple(re.findall(r'"([^"]+)"', match.group(1)))


def test_categories_match_typescript() -> None:
    assert PASTRY_CATEGORIES == _ts_array("PASTRY_CATEGORIES")


def test_constraints_match_typescript() -> None:
    assert DIETARY_CONSTRAINTS == _ts_array("DIETARY_CONSTRAINTS")


def _ts_limits(schema_name: str) -> dict[str, dict[str, int]]:
    # Drop the per-item min(1) so array bounds mean item counts.
    source = SCHEMA_TS.read_text()
    match = re.search(
        rf"export const {schema_name} = z\.object\(\{{(.*?)\n\}}\);", source, re.S
    )
    assert match, f"{schema_name} not found in {SCHEMA_TS}"
    body = match.group(1).replace("z.array(z.string().min(1))", "z.array(z.string())")
    limits: dict[str, dict[str, int]] = {}
    for field, chain in re.findall(r"^  (\w+):(.*?)(?=^  \w+:|\Z)", body, re.S | re.M):
        bounds = {k: int(v) for k, v in re.findall(r"\.(min|max)\((\d+)", chain)}
        if bounds:
            limits[field] = bounds
    return limits


def _py_limits(model: type[BaseModel]) -> dict[str, dict[str, int]]:
    keys = {
        "minLength": "min",
        "maxLength": "max",
        "minItems": "min",
        "maxItems": "max",
    }
    limits: dict[str, dict[str, int]] = {}
    for field, prop in model.model_json_schema(by_alias=True)["properties"].items():
        options = [o for o in prop.get("anyOf", [prop]) if o.get("type") != "null"]
        bounds = {keys[k]: v for k, v in options[0].items() if k in keys}
        if bounds:
            limits[field] = bounds
    return limits


@pytest.mark.parametrize(
    ("model", "schema_name"),
    [(DiagnosisInput, "diagnosisInputSchema"), (Diagnosis, "diagnosisSchema")],
)
def test_field_limits_match_typescript(
    model: type[BaseModel], schema_name: str
) -> None:
    assert _py_limits(model) == _ts_limits(schema_name)


def test_input_payload_uses_api_field_names() -> None:
    parsed = DiagnosisInput(
        category="Cake",
        problem="  My cake sank in the middle after baking.  ",
        technicalDetails="170C fan oven",
        constraints=["Egg-free"],
    )
    assert parsed.to_api_payload() == {
        "category": "Cake",
        "problem": "My cake sank in the middle after baking.",
        "technicalDetails": "170C fan oven",
        "constraints": ["Egg-free"],
    }


@pytest.mark.parametrize(
    "overrides",
    [
        {"category": "Pie"},
        {"problem": "too short"},
        {"problem": "x" * 1001},
        {"constraints": ["Egg-free", "Dairy-free", "Gluten-free", "Egg-free"]},
        {"constraints": ["Nut-free"]},
    ],
)
def test_input_rejects_invalid(overrides: dict[str, object]) -> None:
    valid = {
        "category": "Cake",
        "problem": "My cake sank in the middle.",
        "constraints": [],
    }
    with pytest.raises(ValidationError):
        DiagnosisInput(**{**valid, **overrides})


VALID_DIAGNOSIS = {
    "headline": "Butter too warm",
    "explanation": "Melted butter lets the dough spread.",
    "confidence": "high",
    "causes": ["Butter was too warm"],
    "rescueSteps": [],
    "nextTime": ["Chill the dough"],
    "missingInformation": [],
    "safetyNote": None,
}


def test_diagnosis_accepts_valid_api_payload() -> None:
    parsed = Diagnosis.model_validate(VALID_DIAGNOSIS)
    assert parsed.next_time == ["Chill the dough"]
    assert parsed.safety_note is None


@pytest.mark.parametrize(
    "overrides",
    [
        {"confidence": "certain"},
        {"causes": []},
        {"causes": ["a", "b", "c", "d"]},
        {"nextTime": []},
        {"headline": ""},
        {"safetyNote": ""},
    ],
)
def test_diagnosis_rejects_invalid(overrides: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        Diagnosis.model_validate({**VALID_DIAGNOSIS, **overrides})
