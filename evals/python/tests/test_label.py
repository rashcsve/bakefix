"""Task 1.4: human labelling CLI (saving, resuming, hash check)."""

import json
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from bakefix_evals.judge import CRITERIA
from bakefix_evals.label import (
    HumanLabel,
    ask_score,
    diagnosis_hash,
    find_label,
    load_labels,
    pending_items,
    run_labelling,
    save_labels,
)

DIAGNOSIS: dict[str, Any] = {
    "headline": "Butter too warm",
    "explanation": "It melted.",
    "confidence": "high",
    "causes": ["warm butter"],
    "rescueSteps": [],
    "nextTime": ["Chill the dough."],
    "missingInformation": [],
    "safetyNote": None,
}


def changed(diagnosis: dict[str, Any], **fields: Any) -> dict[str, Any]:
    return {**diagnosis, **fields}


def case(case_id: str) -> dict[str, Any]:
    return {
        "id": case_id,
        "input": {
            "category": "Cookies",
            "problem": f"My cookies spread flat in the oven ({case_id}).",
            "recipe": "200 g butter, 200 g flour",
            "constraints": ["Egg-free"],
        },
        "source": {"url": f"https://example.test/{case_id}"},
    }


def result(case_id: str, diagnosis: dict[str, Any] | None = DIAGNOSIS) -> dict:
    if diagnosis is None:
        return {"id": case_id, "outcome": "http_502", "diagnosis": None}
    return {"id": case_id, "outcome": "ok", "diagnosis": diagnosis}


def label(case_id: str, diagnosis: dict[str, Any] = DIAGNOSIS) -> HumanLabel:
    return HumanLabel(
        case_id=case_id,
        diagnosis_hash=diagnosis_hash(diagnosis),
        scores={name: 3 for name in CRITERIA},
        labelled_at="2026-11-09T10:00:00+00:00",
    )


def scripted(answers: list[str]):
    remaining = iter(answers)

    def fake_input(prompt: str) -> str:
        try:
            return next(remaining)
        except StopIteration:
            raise AssertionError(f"unexpected prompt: {prompt!r}") from None

    return fake_input


# --- hash -----------------------------------------------------------------


def test_hash_ignores_key_order() -> None:
    reordered = dict(reversed(list(DIAGNOSIS.items())))
    assert diagnosis_hash(reordered) == diagnosis_hash(DIAGNOSIS)


def test_hash_changes_when_text_changes() -> None:
    other = changed(DIAGNOSIS, headline="Oven too hot")
    assert diagnosis_hash(other) != diagnosis_hash(DIAGNOSIS)


def test_hash_is_sha256_hex() -> None:
    value = diagnosis_hash(DIAGNOSIS)
    assert len(value) == 64
    int(value, 16)


def test_find_label_matches_only_the_same_diagnosis() -> None:
    labels = [label("se-1")]
    assert find_label(labels, "se-1", DIAGNOSIS) == labels[0]
    assert find_label(labels, "se-1", changed(DIAGNOSIS, headline="Other")) is None
    assert find_label(labels, "se-2", DIAGNOSIS) is None


# --- label schema ---------------------------------------------------------


@pytest.mark.parametrize("bad", [0, 6, "4", 3.5])
def test_label_rejects_out_of_range_scores(bad: object) -> None:
    scores: dict[str, object] = {name: 3 for name in CRITERIA}
    scores["calibration"] = bad
    with pytest.raises(ValidationError):
        HumanLabel(
            case_id="se-1",
            diagnosis_hash=diagnosis_hash(DIAGNOSIS),
            scores=scores,
            labelled_at="2026-11-09T10:00:00+00:00",
        )


def test_label_requires_every_criterion() -> None:
    scores = {name: 3 for name in CRITERIA if name != "plausibility"}
    with pytest.raises(ValidationError):
        HumanLabel(
            case_id="se-1",
            diagnosis_hash=diagnosis_hash(DIAGNOSIS),
            scores=scores,
            labelled_at="2026-11-09T10:00:00+00:00",
        )


# --- saving ---------------------------------------------------------------


def test_load_missing_file_returns_empty(tmp_path: Path) -> None:
    assert load_labels(tmp_path / "human_labels.json") == []


def test_save_then_load_round_trips(tmp_path: Path) -> None:
    path = tmp_path / "human_labels.json"
    labels = [label("se-1"), label("se-2")]
    save_labels(path, labels)
    assert load_labels(path) == labels
    assert isinstance(json.loads(path.read_text()), list)
    assert [p.name for p in tmp_path.iterdir()] == ["human_labels.json"]


# --- pending cases --------------------------------------------------------


def test_pending_skips_failed_and_already_labelled_results() -> None:
    cases = {c["id"]: c for c in (case("se-1"), case("se-2"), case("se-3"))}
    results = [result("se-1"), result("se-2", None), result("se-3")]
    pending = pending_items(results, cases, [label("se-1")])
    assert [item_case["id"] for item_case, _ in pending] == ["se-3"]


def test_pending_includes_case_whose_diagnosis_changed() -> None:
    cases = {"se-1": case("se-1")}
    new = changed(DIAGNOSIS, headline="Oven too hot")
    pending = pending_items([result("se-1", new)], cases, [label("se-1")])
    assert [item_case["id"] for item_case, _ in pending] == ["se-1"]


def test_pending_skips_results_without_a_known_case() -> None:
    assert pending_items([result("se-9")], {"se-1": case("se-1")}, []) == []


# --- prompting ------------------------------------------------------------


def test_ask_score_reprompts_until_valid() -> None:
    shown: list[str] = []
    score = ask_score(
        "plausibility", scripted(["", "0", "abc", "6", " 4 "]), shown.append
    )
    assert score == 4
    assert len(shown) == 4


def test_ask_score_returns_none_on_quit() -> None:
    assert ask_score("plausibility", scripted(["q"]), lambda _: None) is None


# --- run_labelling --------------------------------------------------------


def _write_inputs(tmp_path: Path) -> tuple[Path, Path, Path]:
    report = tmp_path / "latest.json"
    report.write_text(
        json.dumps(
            {
                "results": [
                    result("se-1"),
                    result("se-2", None),
                    result("se-3", changed(DIAGNOSIS, headline="Oven too hot")),
                ]
            }
        )
    )
    cases = tmp_path / "cases.json"
    cases.write_text(json.dumps([case("se-1"), case("se-2"), case("se-3")]))
    return report, cases, tmp_path / "human_labels.json"


def test_run_saves_each_case_and_resumes_after_quit(tmp_path: Path) -> None:
    report, cases, labels_path = _write_inputs(tmp_path)

    shown: list[str] = []
    count = run_labelling(
        report,
        cases,
        labels_path,
        scripted(["5", "4", "3", "2", "1", "q"]),
        shown.append,
    )
    assert count == 1
    saved = load_labels(labels_path)
    assert [x.case_id for x in saved] == ["se-1"]
    assert saved[0].diagnosis_hash == diagnosis_hash(DIAGNOSIS)
    assert saved[0].scores.model_dump() == dict(
        zip(CRITERIA, [5, 4, 3, 2], strict=True)
    )
    output = "\n".join(shown)
    assert "My cookies spread flat in the oven (se-1)." in output
    assert "Butter too warm" in output

    shown.clear()
    count = run_labelling(
        report, cases, labels_path, scripted(["1", "2", "3", "4"]), shown.append
    )
    assert count == 1
    output = "\n".join(shown)
    assert "Oven too hot" in output
    assert "(se-1)." not in output
    assert [x.case_id for x in load_labels(labels_path)] == ["se-1", "se-3"]


def test_run_with_nothing_pending_saves_nothing(tmp_path: Path) -> None:
    report, cases, labels_path = _write_inputs(tmp_path)
    save_labels(
        labels_path,
        [label("se-1"), label("se-3", changed(DIAGNOSIS, headline="Oven too hot"))],
    )
    before = labels_path.read_text()
    assert run_labelling(report, cases, labels_path, scripted([]), lambda _: None) == 0
    assert labels_path.read_text() == before
