import json
from typing import Any

import httpx
import pytest

from bakefix_evals import run_evals
from bakefix_evals.models import DIETARY_CONSTRAINTS, PASTRY_CATEGORIES
from bakefix_evals.report import percentile, summarize, threshold_failures

GOOD = {
    "headline": "Butter too warm",
    "explanation": "It melted.",
    "confidence": "high",
    "causes": ["warm butter"],
    "rescueSteps": [],
    "nextTime": ["Chill the dough."],
    "missingInformation": [],
    "safetyNote": None,
}


def case(
    case_id: str, constraints: list[str] | None = None, category: str = "Cookies"
) -> dict[str, Any]:
    return {
        "id": case_id,
        "input": {
            "category": category,
            "problem": f"My cookies spread flat in the oven ({case_id}).",
            "constraints": constraints or [],
        },
        "source": {"url": f"https://example.test/{case_id}"},
    }


def test_sample_cases_round_robins_groups() -> None:
    cases = [
        case("b1", category="Bread"),
        case("b2", category="Bread"),
        case("b3", category="Bread"),
        case("c1", category="Cake"),
        case("e1", ["Egg-free", "Dairy-free"], category="Bread"),
    ]
    ids = [c["id"] for c in run_evals.sample_cases(cases, 4)]
    assert ids == ["b1", "c1", "e1", "b2"]
    assert run_evals.sample_cases(cases, 0) == cases


def test_default_sample_covers_every_category_and_constraint() -> None:
    cases = json.loads(run_evals.CASES_PATH.read_text())
    sample = run_evals.sample_cases(cases, run_evals.DEFAULT_LIMIT)
    assert {c["input"]["category"] for c in sample} == set(PASTRY_CATEGORIES)
    sampled = {name for c in sample for name in c["input"]["constraints"]}
    assert sampled == set(DIETARY_CONSTRAINTS)


def test_score_covers_every_outcome() -> None:
    c = case("a", ["Egg-free"])
    assert run_evals.score(c, None, None) == {"outcome": "network_error"}
    err = {"ok": False, "code": "RATE_LIMITED"}
    assert run_evals.score(c, 429, err)["error_code"] == "RATE_LIMITED"
    assert run_evals.score(c, 502, "not json")["error_code"] == "HTTP_502"
    bad = {"ok": True, "diagnosis": {**GOOD, "causes": []}}
    assert run_evals.score(c, 200, bad)["outcome"] == "invalid_output"
    ok = run_evals.score(c, 200, {"ok": True, "diagnosis": GOOD})
    assert ok["outcome"] == "ok" and ok["constraint_ok"] and not ok["has_safety_note"]


def _mock_client(monkeypatch, handler) -> None:
    transport = httpx.MockTransport(handler)
    real_client = httpx.Client
    monkeypatch.setattr(
        run_evals.httpx,
        "Client",
        lambda **kw: real_client(transport=transport, **kw),
    )


def test_run_retries_rate_limits(monkeypatch) -> None:
    calls: dict[str, int] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        key = json.loads(request.content)["problem"]
        calls[key] = calls.get(key, 0) + 1
        if calls[key] == 1:
            return httpx.Response(429, json={"ok": False, "code": "RATE_LIMITED"})
        return httpx.Response(200, json={"ok": True, "diagnosis": GOOD})

    monkeypatch.setattr(run_evals.time, "sleep", lambda _: None)
    _mock_client(monkeypatch, handler)
    results = run_evals.run([case("a"), case("b")], "http://test", 0)
    assert [r["outcome"] for r in results] == ["ok", "ok"]
    assert all(r["retries"] == 1 for r in results)


def test_run_retries_network_errors(monkeypatch) -> None:
    calls: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(1)
        if len(calls) < 3:
            raise httpx.ConnectError("connection reset", request=request)
        return httpx.Response(200, json={"ok": True, "diagnosis": GOOD})

    monkeypatch.setattr(run_evals.time, "sleep", lambda _: None)
    _mock_client(monkeypatch, handler)
    [result] = run_evals.run([case("a")], "http://test", 0)
    assert result["outcome"] == "ok" and result["retries"] == 2


def test_run_reports_network_error_after_last_retry(monkeypatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused", request=request)

    monkeypatch.setattr(run_evals.time, "sleep", lambda _: None)
    _mock_client(monkeypatch, handler)
    [result] = run_evals.run([case("a")], "http://test", 0)
    assert result["outcome"] == "network_error"
    assert result["retries"] == run_evals.MAX_RETRIES


def test_min_interval_spaces_request_starts(monkeypatch) -> None:
    sleeps: list[float] = []
    monkeypatch.setattr(run_evals.time, "sleep", sleeps.append)
    _mock_client(
        monkeypatch,
        lambda _: httpx.Response(200, json={"ok": True, "diagnosis": GOOD}),
    )
    run_evals.run([case("a"), case("b"), case("c")], "http://test", 5.0)
    assert len(sleeps) == 2
    assert all(4.0 < seconds <= 5.0 for seconds in sleeps)


def test_summary_rates() -> None:
    base = {"category": "Cake", "latency_ms": 100, "retries": 0}
    results = [
        {
            **base,
            "outcome": "ok",
            "constraints": ["Egg-free"],
            "calibrated": True,
            "constraint_ok": False,
            "has_safety_note": True,
            "confidence": "low",
        },
        {
            **base,
            "outcome": "ok",
            "constraints": [],
            "calibrated": False,
            "constraint_ok": True,
            "has_safety_note": False,
            "confidence": "high",
        },
        {
            **base,
            "outcome": "api_error",
            "constraints": [],
            "error_code": "RATE_LIMITED",
            "latency_ms": 900,
        },
    ]
    s = summarize(results)
    assert s["success_rate"] == 0.667
    assert s["calibration_rate"] == 0.5
    assert s["constraint_compliance"] == 0.0 and s["constrained_cases"] == 1
    assert s["error_codes"] == {"RATE_LIMITED": 1}
    assert s["safety_note_rate"] == 0.5
    assert percentile([1, 2, 3, 4, 100], 0.95) == 100


def test_threshold_failures() -> None:
    summary = {
        "success_rate": 0.8,
        "calibration_rate": None,
        "constraint_compliance": 1.0,
    }
    failures = threshold_failures(
        summary,
        {"success_rate": 0.9, "calibration_rate": 0.5, "constraint_compliance": 0.75},
    )
    assert failures == [
        "Valid diagnosis returned: 80% is below the minimum 90%",
        "Calibrated: no cases to measure",
    ]
    assert threshold_failures(summary, {}) == []


def _run_main(monkeypatch, tmp_path, status: int, body: Any, *flags: str) -> str:
    """Run main() against a mocked server; return the written markdown report."""
    _mock_client(monkeypatch, lambda _: httpx.Response(status, json=body))
    monkeypatch.setattr(run_evals.time, "sleep", lambda _: None)
    monkeypatch.setattr(run_evals.httpx, "get", lambda *a, **kw: None)
    monkeypatch.setattr(run_evals, "REPORTS_DIR", tmp_path)
    argv = ["run_evals", "--limit", "2", "--min-interval", "0", *flags]
    monkeypatch.setattr("sys.argv", argv)
    run_evals.main()
    return (tmp_path / "latest.md").read_text()


def test_main_passes_when_thresholds_are_met(monkeypatch, tmp_path) -> None:
    report = _run_main(
        monkeypatch,
        tmp_path,
        200,
        {"ok": True, "diagnosis": GOOD},
        "--min-success",
        "0.9",
    )
    assert "✅ All thresholds met" in report


def test_main_exits_nonzero_when_thresholds_are_missed(monkeypatch, tmp_path) -> None:
    body = {"ok": False, "code": "AI_UNAVAILABLE"}
    with pytest.raises(SystemExit) as exit_info:
        _run_main(monkeypatch, tmp_path, 502, body, "--min-success", "0.9")
    assert "Valid diagnosis returned: 0%" in str(exit_info.value.code)
    assert "❌ Valid diagnosis returned" in (tmp_path / "latest.md").read_text()


def test_main_rejects_negative_limit(monkeypatch) -> None:
    monkeypatch.setattr("sys.argv", ["run_evals", "--limit", "-1"])
    with pytest.raises(SystemExit) as exit_info:
        run_evals.main()
    assert exit_info.value.code == 2
