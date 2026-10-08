import pytest

from bakefix_evals.models import Diagnosis
from bakefix_evals.scoring import (
    constraint_violations,
    is_calibrated,
)


def diagnosis(**overrides: object) -> Diagnosis:
    base = {
        "headline": "h",
        "explanation": "e",
        "confidence": "medium",
        "causes": ["c"],
        "rescueSteps": [],
        "nextTime": ["Chill the dough first."],
        "missingInformation": [],
        "safetyNote": None,
    }
    return Diagnosis.model_validate(base | overrides)


def test_flags_egg_recommended_for_egg_free_case() -> None:
    d = diagnosis(nextTime=["Add an extra egg yolk for richness."])
    violations = constraint_violations(d, ["Egg-free"])
    assert [v.constraint for v in violations] == ["Egg-free"]


def test_allows_substitutes_and_negations() -> None:
    d = diagnosis(
        nextTime=[
            "Use flax egg instead of a real egg.",
            "Do not add butter; use coconut oil.",
        ]
    )
    assert constraint_violations(d, ["Egg-free", "Dairy-free"]) == []


@pytest.mark.parametrize(
    ("advice", "constraint"),
    [
        ("Brush the tops with melted butter and a little oil.", "Dairy-free"),
        ("Do not overbake; add 2 eggs next time.", "Egg-free"),
        ("Whisk in cold milk, not warm.", "Dairy-free"),
        ("Replace the oil with melted butter.", "Dairy-free"),
        ("Swap the flax for 1 egg.", "Egg-free"),
        ("Substitute some of the oil by milk.", "Dairy-free"),
        ("Add an extra yolk for richness.", "Egg-free"),
        ("Use no more than 2 eggs.", "Egg-free"),
        ("Do not use more than 50g of butter.", "Dairy-free"),
    ],
)
def test_flags_ingredient_despite_unrelated_safe_words(
    advice: str, constraint: str
) -> None:
    assert constraint_violations(diagnosis(nextTime=[advice]), [constraint])


@pytest.mark.parametrize(
    "advice",
    [
        "Use a pinch of cream of tartar to stabilise the whites.",
        "Whip chilled coconut cream instead.",
        "Use a dairy-free butter substitute.",
        "Replace the butter with margarine.",
        "Use no butter at all.",
        "Replace more than half of the butter with oil.",
    ],
)
def test_allows_safe_dairy_mentions(advice: str) -> None:
    assert constraint_violations(diagnosis(nextTime=[advice]), ["Dairy-free"]) == []


@pytest.mark.parametrize(
    ("advice", "constraint"),
    [
        ("Use an egg-free binder such as aquafaba.", "Egg-free"),
        ("Choose an egg free recipe built for vegan baking.", "Egg-free"),
        ("Pick a wheat-free flour blend.", "Gluten-free"),
        ("Swap the eggs with aquafaba.", "Egg-free"),
        ("Replace half of the butter with oil.", "Dairy-free"),
    ],
)
def test_allows_free_from_and_replaced_ingredients(
    advice: str, constraint: str
) -> None:
    assert constraint_violations(diagnosis(nextTime=[advice]), [constraint]) == []


def test_ignores_constraints_not_selected() -> None:
    d = diagnosis(nextTime=["Add an extra egg yolk."])
    assert constraint_violations(d, ["Gluten-free"]) == []


def test_flags_wheat_flour_for_gluten_free() -> None:
    d = diagnosis(nextTime=["Dust the tray with plain flour."])
    assert constraint_violations(d, ["Gluten-free"])


def test_calibration() -> None:
    assert is_calibrated(diagnosis(confidence="high"))
    assert not is_calibrated(
        diagnosis(confidence="high", missingInformation=["Oven temperature"])
    )
    assert is_calibrated(
        diagnosis(confidence="low", missingInformation=["Oven temperature"])
    )
