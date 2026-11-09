"""Task 1.3: judge scores in the eval run and report."""

import json
from typing import Any

import httpx
import pytest

from bakefix_evals import run_evals
from bakefix_evals.judge import CRITERIA, JUDGE_SKIP_MESSAGE, JudgeError, JudgeVerdict
from bakefix_evals.models import Diagnosis, DiagnosisInput
from bakefix_evals.report import render_markdown, summarize

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


def case(case_id: str, category: str = "Cookies") -> dict[str, Any]:
    return {
        "id": case_id,
        "input": {
            "category": category,
            "problem": f"My bake went wrong in the oven ({case_id}).",
            "constraints": ["Egg-free"],
        },
        "source": {"url": f"https://example.test/{case_id}"},
    }


def verdict(*scores: int, reason: str = "Fine.") -> dict[str, dict[str, Any]]:
    return {
        name: {"score": s, "reason": f"{name} {reason}"}
        for name, s in zip(CRITERIA, scores, strict=True)
    }


def _mock_client(monkeypatch, handler) -> None:
    transport = httpx.MockTransport(handler)
    real_client = httpx.Client
    monkeypatch.setattr(
        run_evals.httpx,
        "Client",
        lambda **kw: real_client(transport=transport, **kw),
    )


# --- run() ---------------------------------------------------------------


def test_run_judges_only_valid_diagnoses(monkeypatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if "(bad)" in json.loads(request.content)["problem"]:
            return httpx.Response(502, json={"ok": False, "code": "AI_UNAVAILABLE"})
        return httpx.Response(200, json={"ok": True, "diagnosis": GOOD})

    seen: list[tuple[DiagnosisInput, Diagnosis]] = []

    def fake_judge(case_input: DiagnosisInput, diagnosis: Diagnosis) -> JudgeVerdict:
        seen.append((case_input, diagnosis))
        return JudgeVerdict.model_validate(verdict(5, 4, 3, 2))

    _mock_client(monkeypatch, handler)
    good, bad = run_evals.run(
        [case("good", "Cake"), case("bad")], "http://test", 0, judge_case=fake_judge
    )

    assert len(seen) == 1
    case_input, diagnosis = seen[0]
    assert case_input.category == "Cake" and "(good)" in case_input.problem
    assert case_input.constraints == ["Egg-free"]
    assert diagnosis.headline == GOOD["headline"]
    assert good["judge"] == verdict(5, 4, 3, 2)
    assert "judge_error" not in good
    assert "judge" not in bad and "judge_error" not in bad


def test_run_records_judge_failures(monkeypatch) -> None:
    _mock_client(
        monkeypatch,
        lambda _: httpx.Response(200, json={"ok": True, "diagnosis": GOOD}),
    )
    [result] = run_evals.run(
        [case("a")],
        "http://test",
        0,
        judge_case=lambda *_: JudgeError("timeout", "No answer within 30s"),
    )
    assert result["outcome"] == "ok"
    assert result["judge_error"] == {
        "code": "timeout",
        "detail": "No answer within 30s",
    }
    assert "judge" not in result


def test_run_without_judge_adds_no_judge_fields(monkeypatch) -> None:
    _mock_client(
        monkeypatch,
        lambda _: httpx.Response(200, json={"ok": True, "diagnosis": GOOD}),
    )
    [result] = run_evals.run([case("a")], "http://test", 0)
    assert "judge" not in result and "judge_error" not in result


# --- summarize() / render_markdown() ---------------------------------------


def _result(case_id: str, category: str, **extra: Any) -> dict[str, Any]:
    base = {
        "id": case_id,
        "category": category,
        "constraints": [],
        "latency_ms": 100,
        "outcome": "ok",
        "calibrated": True,
        "constraint_ok": True,
        "has_safety_note": False,
        "confidence": "low",
    }
    return {**base, **extra}


JUDGED_RESULTS = [
    _result("c1", "Cake", judge=verdict(5, 5, 5, 5)),
    _result("c2", "Cake", judge=verdict(3, 4, 5, 2, reason="weak")),
    _result("b1", "Bread", judge=verdict(1, 2, 1, 2, reason="worst")),
    _result("b2", "Bread", judge=verdict(4, 4, 4, 4)),
    _result("b3", "Bread", judge_error={"code": "timeout", "detail": "30s"}),
    _result("k1", "Cookies", judge_error={"code": "rate_limited", "detail": "429"}),
    _result(
        "x1",
        "Cake",
        outcome="api_error",
        error_code="AI_UNAVAILABLE",
    ),
]


def test_summary_has_no_judge_section_when_nothing_was_judged() -> None:
    assert summarize([_result("a", "Cake")])["judge"] is None


def test_summary_counts_judged_and_failed_cases() -> None:
    judge = summarize(JUDGED_RESULTS)["judge"]
    assert judge["judged"] == 4
    assert judge["failed"] == 2
    assert judge["error_codes"] == {"timeout": 1, "rate_limited": 1}


def test_summary_means_overall_and_per_category() -> None:
    judge = summarize(JUDGED_RESULTS)["judge"]
    assert judge["mean"] == {
        "plausibility": 3.25,
        "actionability": 3.75,
        "constraint_respect": 3.75,
        "calibration": 3.25,
    }
    assert judge["by_category"]["Cake"] == {
        "judged": 2,
        "mean": {
            "plausibility": 4.0,
            "actionability": 4.5,
            "constraint_respect": 5.0,
            "calibration": 3.5,
        },
    }
    assert judge["by_category"]["Bread"]["judged"] == 2
    assert judge["by_category"]["Bread"]["mean"]["plausibility"] == 2.5
    # A category whose every judge call failed has no means, not zeros.
    assert judge["by_category"]["Cookies"] == {
        "judged": 0,
        "mean": dict.fromkeys(CRITERIA),
    }


def test_summary_lists_the_three_lowest_scored_cases() -> None:
    lowest = summarize(JUDGED_RESULTS)["judge"]["lowest"]
    assert [c["id"] for c in lowest] == ["b1", "c2", "b2"]
    assert lowest[0] == {
        "id": "b1",
        "category": "Bread",
        "total": 6,
        "scores": verdict(1, 2, 1, 2, reason="worst"),
    }


def test_summary_lowest_has_fewer_entries_when_few_were_judged() -> None:
    results = [_result("a", "Cake", judge=verdict(4, 4, 4, 4))]
    assert [c["id"] for c in summarize(results)["judge"]["lowest"]] == ["a"]


def test_report_shows_judge_means_failures_and_lowest_cases() -> None:
    report = render_markdown(
        summarize(JUDGED_RESULTS), "http://test", "now", judge_model="judge-model"
    )
    assert "## Judge" in report
    assert "judge-model" in report
    assert "| plausibility | 3.25 |" in report
    assert "| Cake | 2 | 4.00 | 4.50 | 5.00 | 3.50 |" in report
    assert "| Cookies | 0 | n/a | n/a | n/a | n/a |" in report
    assert "Judge failures: 2" in report
    assert "rate_limited" in report and "timeout" in report
    assert "`b1`" in report
    assert "plausibility worst" in report
    assert "calibration weak" in report


def test_report_has_no_judge_section_without_verdicts() -> None:
    report = render_markdown(summarize([_result("a", "Cake")]), "http://test", "now")
    assert "## Judge" not in report


# --- main() --judge ------------------------------------------------------------


JUDGE_URL = "https://judge.test/v1"


def _completion(content: dict[str, Any]) -> httpx.Response:
    return httpx.Response(
        200,
        json={"choices": [{"message": {"content": json.dumps(content)}}]},
    )


def _run_main(monkeypatch, tmp_path, env: dict[str, str], *flags: str) -> list[str]:
    """Run main() with the app and the judge mocked; return judge request URLs."""
    judge_calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "judge.test":
            judge_calls.append(str(request.url))
            return _completion(verdict(4, 3, 5, 2))
        return httpx.Response(200, json={"ok": True, "diagnosis": GOOD})

    _mock_client(monkeypatch, handler)
    monkeypatch.setattr(run_evals.time, "sleep", lambda _: None)
    monkeypatch.setattr(run_evals.httpx, "get", lambda *a, **kw: None)
    monkeypatch.setattr(run_evals, "REPORTS_DIR", tmp_path)
    for name in ("JUDGE_API_KEY", "JUDGE_BASE_URL", "JUDGE_MODEL"):
        monkeypatch.delenv(name, raising=False)
    for name, value in env.items():
        monkeypatch.setenv(name, value)
    argv = ["run_evals", "--limit", "2", "--min-interval", "0", *flags]
    monkeypatch.setattr("sys.argv", argv)
    run_evals.main()
    return judge_calls


JUDGE_ENV = {
    "JUDGE_API_KEY": "test-key",
    "JUDGE_BASE_URL": JUDGE_URL,
    "JUDGE_MODEL": "judge-model",
}


def test_main_with_judge_stores_verdicts_and_renders_them(
    monkeypatch, tmp_path
) -> None:
    calls = _run_main(monkeypatch, tmp_path, JUDGE_ENV, "--judge")
    assert calls == [f"{JUDGE_URL}/chat/completions"] * 2

    payload = json.loads((tmp_path / "latest.json").read_text())
    assert payload["judge_model"] == "judge-model"
    assert all(r["judge"] == verdict(4, 3, 5, 2) for r in payload["results"])
    assert payload["summary"]["judge"]["judged"] == 2

    report = (tmp_path / "latest.md").read_text()
    assert "## Judge" in report and "judge-model" in report
    assert "| plausibility | 4.00 |" in report


def test_main_without_judge_flag_never_calls_the_judge(monkeypatch, tmp_path) -> None:
    calls = _run_main(monkeypatch, tmp_path, JUDGE_ENV)
    assert calls == []
    payload = json.loads((tmp_path / "latest.json").read_text())
    assert payload["summary"]["judge"] is None
    assert payload["judge_model"] is None
    assert "## Judge" not in (tmp_path / "latest.md").read_text()


def test_main_with_judge_but_no_key_skips_with_message(
    monkeypatch, tmp_path, capsys: pytest.CaptureFixture[str]
) -> None:
    calls = _run_main(monkeypatch, tmp_path, {}, "--judge")
    assert calls == []
    assert capsys.readouterr().out.count(JUDGE_SKIP_MESSAGE) == 1
    payload = json.loads((tmp_path / "latest.json").read_text())
    assert [r["outcome"] for r in payload["results"]] == ["ok", "ok"]
    assert payload["summary"]["judge"] is None
