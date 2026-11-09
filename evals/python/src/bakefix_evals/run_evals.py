"""Run the parsed cases against a live BakeFix server and score the responses.

uv run python -m bakefix_evals.run_evals            # 12 cases, every category
uv run python -m bakefix_evals.run_evals --limit 0  # every case
uv run python -m bakefix_evals.run_evals --judge    # also grade with the LLM judge

Pass --min-* rates (0-1) to exit with status 1 when a run scores below them.
"""

import argparse
import json
import os
import time
from collections.abc import Callable
from contextlib import ExitStack
from functools import partial
from itertools import zip_longest
from pathlib import Path
from typing import Any

import httpx
from pydantic import ValidationError

from bakefix_evals.judge import (
    JUDGE_SKIP_MESSAGE,
    JudgeError,
    JudgeVerdict,
    judge,
    judge_config_from_env,
)
from bakefix_evals.models import Diagnosis, DiagnosisInput
from bakefix_evals.report import GATED_RATES, write_reports
from bakefix_evals.scoring import (
    constraint_violations,
    is_calibrated,
)

ROOT = Path(__file__).resolve().parents[2]
CASES_PATH = ROOT / "data" / "cases.json"
REPORTS_DIR = ROOT / "reports"
MAX_RETRIES = 3
RETRY_BACKOFF_S = 10
DEFAULT_LIMIT = 12
DEFAULT_MIN_INTERVAL_S = 13.0
# Last model the server called; absent when none was.
MODEL_HEADER = "X-BakeFix-Model"
# CLI flag -> summary rate it gates.
THRESHOLD_FLAGS = {
    "min_success": "success_rate",
    "min_calibration": "calibration_rate",
    "min_constraint": "constraint_compliance",
}

JudgeCase = Callable[[DiagnosisInput, Diagnosis], JudgeVerdict | JudgeError]


def call_api(
    client: httpx.Client, base_url: str, payload: dict[str, Any]
) -> tuple[int | None, Any, int, int, str | None]:
    # Retry 429s and network errors. Time only the last attempt, so retry waits
    # don't count as latency.
    for attempt in range(MAX_RETRIES + 1):
        start = time.perf_counter()
        try:
            response = client.post(f"{base_url}/api/diagnose", json=payload)
        except httpx.HTTPError:
            response = None
        if attempt == MAX_RETRIES or (
            response is not None and response.status_code != 429
        ):
            break
        time.sleep(RETRY_BACKOFF_S * (attempt + 1))
    ms = int((time.perf_counter() - start) * 1000)
    if response is None:
        return None, None, ms, attempt, None
    try:
        body = response.json()
    except ValueError:
        body = None
    model = response.headers.get(MODEL_HEADER)
    return response.status_code, body, ms, attempt, model


def sample_cases(cases: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    # Round-robin over constraints and categories so a short run covers each one;
    # cases.json is ordered by votes, not by coverage.
    groups: dict[str, list[dict[str, Any]]] = {}
    for case in cases:
        constraints = case["input"]["constraints"]
        key = constraints[0] if constraints else case["input"]["category"]
        groups.setdefault(key, []).append(case)
    rounds = zip_longest(*groups.values())
    ordered = [case for row in rounds for case in row if case is not None]
    return ordered[:limit] if limit else cases


def score(case: dict[str, Any], status: int | None, body: Any) -> dict[str, Any]:
    if status is None:
        return {"outcome": "network_error"}
    if not isinstance(body, dict) or not body.get("ok"):
        code = body.get("code") if isinstance(body, dict) else None
        return {"outcome": "api_error", "error_code": code or f"HTTP_{status}"}
    try:
        diagnosis = Diagnosis.model_validate(body.get("diagnosis"))
    except ValidationError as error:
        return {"outcome": "invalid_output", "detail": str(error.errors()[:2])}
    constraints = case["input"].get("constraints", [])
    violations = constraint_violations(diagnosis, constraints)
    return {
        "outcome": "ok",
        "confidence": diagnosis.confidence,
        "calibrated": is_calibrated(diagnosis),
        "constraint_ok": not violations,
        "violations": [v.__dict__ for v in violations],
        "has_safety_note": diagnosis.safety_note is not None,
        "diagnosis": diagnosis.model_dump(by_alias=True),
    }


def judge_fields(
    case: dict[str, Any], result: dict[str, Any], judge_case: JudgeCase
) -> dict[str, Any]:
    """Judge a valid diagnosis; failures are kept so the report can count them."""
    outcome = judge_case(
        DiagnosisInput.model_validate(case["input"]),
        Diagnosis.model_validate(result["diagnosis"]),
    )
    if isinstance(outcome, JudgeError):
        return {"judge_error": {"code": outcome.code, "detail": outcome.detail}}
    return {"judge": outcome.model_dump()}


def run(
    cases: list[dict[str, Any]],
    base_url: str,
    min_interval: float,
    judge_case: JudgeCase | None = None,
) -> list[dict[str, Any]]:
    # One request at a time: the free tier's rate limit, not the client, is the
    # bottleneck, so requests start at least `min_interval` seconds apart.
    results: list[dict[str, Any]] = []
    last_start: float | None = None
    with httpx.Client(timeout=40) as client:
        for case in cases:
            if last_start is not None:
                delay = last_start + min_interval - time.monotonic()
                if delay > 0:
                    time.sleep(delay)
            last_start = time.monotonic()
            status, body, ms, retries, model = call_api(client, base_url, case["input"])
            result = score(case, status, body)
            if judge_case is not None and result["outcome"] == "ok":
                result |= judge_fields(case, result, judge_case)
            print(f"{case['id']:>12}  {result['outcome']:<15} {ms:>6} ms")
            results.append(
                {
                    "id": case["id"],
                    "category": case["input"]["category"],
                    "constraints": case["input"]["constraints"],
                    "source_url": case["source"]["url"],
                    "latency_ms": ms,
                    "retries": retries,
                    "model": model,
                    **result,
                }
            )
    return results


def non_negative_int(value: str) -> int:
    number = int(value)
    if number < 0:
        raise argparse.ArgumentTypeError("must be 0 or more")
    return number


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--base-url", default=os.environ.get("EVAL_BASE_URL"))
    parser.add_argument(
        "--limit",
        type=non_negative_int,
        default=DEFAULT_LIMIT,
        help=f"cases to run, spread across categories and constraints "
        f"(default {DEFAULT_LIMIT}); 0 runs every case",
    )
    parser.add_argument(
        "--min-interval",
        type=float,
        default=DEFAULT_MIN_INTERVAL_S,
        help="seconds between request starts (default %(default)s, sized for "
        "Gemini's free tier of about 5 requests a minute); 0 disables",
    )
    parser.add_argument(
        "--judge",
        action="store_true",
        help="grade every valid diagnosis with the LLM judge (needs JUDGE_API_KEY "
        "in the shell; skipped with a message without it)",
    )
    for dest, rate in THRESHOLD_FLAGS.items():
        parser.add_argument(
            f"--{dest.replace('_', '-')}",
            type=float,
            metavar="RATE",
            help=f"fail if '{GATED_RATES[rate]}' is below RATE (0-1)",
        )
    args = parser.parse_args()
    minimums = {
        rate: getattr(args, dest)
        for dest, rate in THRESHOLD_FLAGS.items()
        if getattr(args, dest) is not None
    }

    base_url = (args.base_url or "http://localhost:3000").rstrip("/")
    cases = sample_cases(json.loads(CASES_PATH.read_text()), args.limit)
    try:
        httpx.get(base_url, timeout=5)
    except httpx.HTTPError:
        raise SystemExit(
            f"No server reachable at {base_url}. Start it with `pnpm dev`."
        ) from None

    judge_config = judge_config_from_env(os.environ) if args.judge else None
    if args.judge and judge_config is None:
        print(JUDGE_SKIP_MESSAGE)

    with ExitStack() as stack:
        judge_case: JudgeCase | None = None
        if judge_config is not None:
            judge_client = stack.enter_context(httpx.Client())
            judge_case = partial(judge, judge_client, judge_config)
        results = run(cases, base_url, args.min_interval, judge_case)

    failures = write_reports(
        results,
        base_url,
        REPORTS_DIR,
        minimums,
        judge_model=judge_config.model if judge_config else None,
    )
    if failures:
        raise SystemExit(
            "Thresholds not met:\n" + "\n".join(f"- {f}" for f in failures)
        )


if __name__ == "__main__":
    main()
