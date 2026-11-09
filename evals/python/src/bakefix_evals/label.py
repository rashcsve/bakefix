"""Label diagnoses by hand so the LLM judge can be checked against a human.

uv run python -m bakefix_evals.label                       # reports/latest.json
uv run python -m bakefix_evals.label --report path/to/run.json

Shows each valid diagnosis that has no label yet and asks for the four rubric
scores. Every finished case is saved at once, so you can quit (q) and resume.
A label stores a hash of the diagnosis, so it never matches a different answer.
"""

import argparse
import hashlib
import json
import os
import sys
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, TypeAdapter

from bakefix_evals.judge import CRITERIA, RUBRIC, Score
from bakefix_evals.run_evals import CASES_PATH, REPORTS_DIR, ROOT

LABELS_PATH = ROOT / "data" / "human_labels.json"
QUIT = "q"

InputFn = Callable[[str], str]
OutputFn = Callable[[str], None]
PendingItem = tuple[dict[str, Any], dict[str, Any]]


class HumanScores(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plausibility: Score
    actionability: Score
    constraint_respect: Score
    calibration: Score


class HumanLabel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    case_id: str
    diagnosis_hash: str
    scores: HumanScores
    labelled_at: str


_LABELS = TypeAdapter(list[HumanLabel])


def diagnosis_hash(diagnosis: dict[str, Any]) -> str:
    canonical = json.dumps(
        diagnosis, sort_keys=True, ensure_ascii=False, separators=(",", ":")
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def find_label(
    labels: list[HumanLabel], case_id: str, diagnosis: dict[str, Any]
) -> HumanLabel | None:
    wanted = diagnosis_hash(diagnosis)
    for label in labels:
        if label.case_id == case_id and label.diagnosis_hash == wanted:
            return label
    return None


def load_labels(path: Path) -> list[HumanLabel]:
    if not path.exists():
        return []
    return _LABELS.validate_json(path.read_bytes())


def save_labels(path: Path, labels: list[HumanLabel]) -> None:
    """Write to a temporary file, then rename, so a crash never truncates labels."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(_LABELS.dump_json(labels, indent=2) + b"\n")
    os.replace(tmp, path)


def pending_items(
    results: list[dict[str, Any]],
    cases_by_id: dict[str, dict[str, Any]],
    labels: list[HumanLabel],
) -> list[PendingItem]:
    pending: list[PendingItem] = []
    for result in results:
        diagnosis = result.get("diagnosis")
        case = cases_by_id.get(result["id"])
        if result.get("outcome") != "ok" or not diagnosis or case is None:
            continue
        if find_label(labels, result["id"], diagnosis) is None:
            pending.append((case, result))
    return pending


def ask_score(criterion: str, input_fn: InputFn, output_fn: OutputFn) -> int | None:
    """Return a score 1-5, or None when the user quits."""
    while True:
        raw = input_fn(f"{criterion} (1-5, {QUIT} to quit): ").strip().lower()
        if raw == QUIT:
            return None
        if raw in {"1", "2", "3", "4", "5"}:
            return int(raw)
        output_fn(f"Enter a whole number from 1 to 5, or {QUIT} to quit.")


def _bullets(title: str, items: list[str]) -> list[str]:
    return [f"{title}:", *(f"  - {item}" for item in items or ["(none)"])]


def render_item(case: dict[str, Any], diagnosis: dict[str, Any]) -> str:
    case_input = case["input"]
    lines = [
        "=" * 72,
        f"Case {case['id']} · {case_input['category']}",
        f"Constraints: {', '.join(case_input.get('constraints') or []) or 'none'}",
        "",
        "Problem:",
        case_input["problem"],
    ]
    for key, title in (("recipe", "Recipe"), ("technicalDetails", "Details")):
        if case_input.get(key):
            lines += ["", f"{title}:", case_input[key]]
    lines += [
        "-" * 72,
        f"Headline: {diagnosis['headline']}",
        f"Confidence: {diagnosis['confidence']}",
        "",
        diagnosis["explanation"],
        "",
        *_bullets("Causes", diagnosis["causes"]),
        *_bullets("Rescue steps", diagnosis["rescueSteps"]),
        *_bullets("Next time", diagnosis["nextTime"]),
        *_bullets("Missing information", diagnosis["missingInformation"]),
        f"Safety note: {diagnosis.get('safetyNote') or '(none)'}",
        "-" * 72,
    ]
    return "\n".join(lines)


def run_labelling(
    report_path: Path,
    cases_path: Path,
    labels_path: Path,
    input_fn: InputFn = input,
    output_fn: OutputFn = print,
) -> int:
    """Label pending cases; return how many were labelled in this session."""
    results = json.loads(report_path.read_text())["results"]
    cases_by_id = {case["id"]: case for case in json.loads(cases_path.read_text())}
    labels = load_labels(labels_path)
    pending = pending_items(results, cases_by_id, labels)
    if not pending:
        output_fn(f"Nothing to label: {len(labels)} labels saved.")
        return 0

    output_fn(f"Rubric:\n\n{RUBRIC}\n")
    labelled = 0
    for index, (case, result) in enumerate(pending, start=1):
        output_fn(f"\n[{index}/{len(pending)}]")
        output_fn(render_item(case, result["diagnosis"]))
        scores: dict[str, int] = {}
        for criterion in CRITERIA:
            score = ask_score(criterion, input_fn, output_fn)
            if score is None:
                output_fn(f"Stopped. Labelled {labelled} this session; saved.")
                return labelled
            scores[criterion] = score
        labels.append(
            HumanLabel(
                case_id=case["id"],
                diagnosis_hash=diagnosis_hash(result["diagnosis"]),
                scores=HumanScores.model_validate(scores),
                labelled_at=datetime.now(UTC).isoformat(timespec="seconds"),
            )
        )
        save_labels(labels_path, labels)
        labelled += 1
    output_fn(f"Done. Labelled {labelled} this session; {len(labels)} in total.")
    return labelled


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--report", type=Path, default=REPORTS_DIR / "latest.json")
    parser.add_argument("--cases", type=Path, default=CASES_PATH)
    parser.add_argument("--labels", type=Path, default=LABELS_PATH)
    args = parser.parse_args()
    if not args.report.exists():
        sys.exit(f"No report at {args.report}. Run run_evals first.")
    try:
        run_labelling(args.report, args.cases, args.labels)
    except (KeyboardInterrupt, EOFError):
        print("\nStopped. Finished cases are saved.")


if __name__ == "__main__":
    main()
