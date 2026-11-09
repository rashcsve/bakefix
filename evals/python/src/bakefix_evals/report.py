import json
import statistics
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from bakefix_evals.judge import CRITERIA

LOWEST_JUDGED = 3


def percentile(values: list[int], pct: float) -> int:
    if not values:
        return 0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, round(pct * (len(ordered) - 1)))]


def _rate(numerator: int, denominator: int) -> float | None:
    return round(numerator / denominator, 3) if denominator else None


def _mean_scores(verdicts: list[dict[str, Any]]) -> dict[str, float | None]:
    return {
        name: round(statistics.mean(v[name]["score"] for v in verdicts), 2)
        if verdicts
        else None
        for name in CRITERIA
    }


def _total(verdict: dict[str, Any]) -> int:
    return sum(verdict[name]["score"] for name in CRITERIA)


def summarize_judge(results: list[dict[str, Any]]) -> dict[str, Any] | None:
    """None when no case went to the judge (no --judge, or no valid diagnoses)."""
    attempted = [r for r in results if "judge" in r or "judge_error" in r]
    if not attempted:
        return None
    judged = [r for r in attempted if "judge" in r]
    by_category: dict[str, dict[str, Any]] = {}
    for category in sorted({r["category"] for r in attempted}):
        group = [r["judge"] for r in judged if r["category"] == category]
        by_category[category] = {"judged": len(group), "mean": _mean_scores(group)}
    # sorted() is stable, so ties keep run order.
    lowest = sorted(judged, key=lambda r: _total(r["judge"]))[:LOWEST_JUDGED]
    return {
        "judged": len(judged),
        "failed": len(attempted) - len(judged),
        "error_codes": dict(
            Counter(r["judge_error"]["code"] for r in attempted if "judge_error" in r)
        ),
        "mean": _mean_scores([r["judge"] for r in judged]),
        "by_category": by_category,
        "lowest": [
            {
                "id": r["id"],
                "category": r["category"],
                "total": _total(r["judge"]),
                "scores": r["judge"],
            }
            for r in lowest
        ],
    }


def summarize(results: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(results)
    ok = [r for r in results if r["outcome"] == "ok"]
    constrained = [r for r in ok if r["constraints"]]
    latencies = [r["latency_ms"] for r in results]
    by_category: dict[str, dict[str, Any]] = {}
    for category in sorted({r["category"] for r in results}):
        group = [r for r in results if r["category"] == category]
        group_ok = [r for r in group if r["outcome"] == "ok"]
        by_category[category] = {
            "cases": len(group),
            "success_rate": _rate(len(group_ok), len(group)),
        }
    # Cases with no model header aren't counted: network errors, limiter 429s,
    # a missing API key, unexpected server errors.
    models: dict[str, dict[str, int]] = {}
    for model in sorted({r["model"] for r in results if r.get("model")}):
        group = [r for r in results if r.get("model") == model]
        models[model] = {
            "cases": len(group),
            "ok": sum(r["outcome"] == "ok" for r in group),
        }
    return {
        "cases": total,
        "success_rate": _rate(len(ok), total),
        "outcomes": dict(Counter(r["outcome"] for r in results)),
        "error_codes": dict(
            Counter(r["error_code"] for r in results if "error_code" in r)
        ),
        "calibration_rate": _rate(sum(r["calibrated"] for r in ok), len(ok)),
        "constrained_cases": len(constrained),
        "constraint_compliance": _rate(
            sum(r["constraint_ok"] for r in constrained), len(constrained)
        ),
        # Informational only: no check can tell when a note is due.
        "safety_note_rate": _rate(sum(r["has_safety_note"] for r in ok), len(ok)),
        "confidence": dict(Counter(r["confidence"] for r in ok)),
        "latency_ms": {
            "p50": int(statistics.median(latencies)) if latencies else 0,
            "p95": percentile(latencies, 0.95),
        },
        "by_category": by_category,
        "models": models,
        "judge": summarize_judge(results),
    }


def _pct(value: float | None) -> str:
    return "n/a" if value is None else f"{value * 100:.0f}%"


# Summary rates a run can be gated on, with the label used in messages.
GATED_RATES = {
    "success_rate": "Valid diagnosis returned",
    "calibration_rate": "Calibrated",
    "constraint_compliance": "Dietary constraints respected",
}


def threshold_failures(
    summary: dict[str, Any], minimums: dict[str, float]
) -> list[str]:
    """One message per gated rate below its minimum. An unmeasurable rate fails
    too, so a run that never exercised a check cannot pass it by default."""
    failures: list[str] = []
    for key, minimum in minimums.items():
        value = summary[key]
        if value is None:
            failures.append(f"{GATED_RATES[key]}: no cases to measure")
        elif value < minimum:
            failures.append(
                f"{GATED_RATES[key]}: {_pct(value)} is below the minimum {_pct(minimum)}"
            )
    return failures


def _score(value: float | None) -> str:
    return "n/a" if value is None else f"{value:.2f}"


def render_judge(judge: dict[str, Any], judge_model: str | None) -> list[str]:
    errors = ", ".join(f"{code}: {n}" for code, n in judge["error_codes"].items())
    lines = [
        "",
        "## Judge",
        "",
        f"Judge model: `{judge_model or 'unknown'}` — {judge['judged']} cases judged, "
        "scores 1–5.  ",
        f"Judge failures: {judge['failed']}" + (f" ({errors})" if errors else ""),
        "",
        "| Criterion | Mean |",
        "| --- | --- |",
    ]
    lines += [f"| {name} | {_score(judge['mean'][name])} |" for name in CRITERIA]
    lines += [
        "",
        "| Category | Judged | " + " | ".join(CRITERIA) + " |",
        "| --- | --- |" + " --- |" * len(CRITERIA),
    ]
    for category, row in judge["by_category"].items():
        means = " | ".join(_score(row["mean"][name]) for name in CRITERIA)
        lines.append(f"| {category} | {row['judged']} | {means} |")
    if judge["lowest"]:
        lines += ["", "Lowest-scored cases:", ""]
        for case in judge["lowest"]:
            lines.append(
                f"- `{case['id']}` ({case['category']}), "
                f"total {case['total']}/{5 * len(CRITERIA)}"
            )
            lines += [
                f"  - {name} {case['scores'][name]['score']}: "
                f"{case['scores'][name]['reason']}"
                for name in CRITERIA
            ]
    return lines


def render_markdown(
    summary: dict[str, Any],
    base_url: str,
    stamp: str,
    minimums: dict[str, float] | None = None,
    judge_model: str | None = None,
) -> str:
    lines = [
        "# Python eval report",
        "",
        f"Run: {stamp} against `{base_url}` — {summary['cases']} cases.",
        "",
        "| Check | Result |",
        "| --- | --- |",
        f"| Valid diagnosis returned | {_pct(summary['success_rate'])} |",
        f"| Calibrated (not high confidence with missing info) | {_pct(summary['calibration_rate'])} |",
        f"| Dietary constraints respected ({summary['constrained_cases']} cases) | {_pct(summary['constraint_compliance'])} |",
        f"| Safety note included (informational, not pass/fail) | {_pct(summary['safety_note_rate'])} |",
        f"| Latency p50 / p95 | {summary['latency_ms']['p50']} ms / {summary['latency_ms']['p95']} ms |",
        "",
        f"Outcomes: {summary['outcomes']}  ",
        f"Error codes: {summary['error_codes'] or 'none'}  ",
        f"Confidence: {summary['confidence']}",
        "",
        "| Category | Cases | Success |",
        "| --- | --- | --- |",
    ]
    for name, row in summary["by_category"].items():
        lines.append(f"| {name} | {row['cases']} | {_pct(row['success_rate'])} |")
    if summary["models"]:
        lines += [
            "",
            "Answered by:",
            "",
            "| Model | Cases | Valid |",
            "| --- | --- | --- |",
        ]
        for name, row in summary["models"].items():
            lines.append(f"| {name} | {row['cases']} | {row['ok']} |")
    else:
        lines += ["", "Answered by: none (no X-BakeFix-Model header)"]
    if summary["judge"] is not None:
        lines += render_judge(summary["judge"], judge_model)
    if minimums:
        failures = threshold_failures(summary, minimums)
        lines += ["", "## Thresholds", ""]
        lines += [f"- ❌ {f}" for f in failures] or ["- ✅ All thresholds met"]
    return "\n".join(lines) + "\n"


def write_reports(
    results: list[dict[str, Any]],
    base_url: str,
    out_dir: Path,
    minimums: dict[str, float] | None = None,
    judge_model: str | None = None,
) -> list[str]:
    """Write latest.json and latest.md; return any threshold failures."""
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
    summary = summarize(results)
    payload = {
        "run_at": stamp,
        "base_url": base_url,
        "judge_model": judge_model,
        "summary": summary,
        "results": results,
    }
    (out_dir / "latest.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    )
    markdown = render_markdown(summary, base_url, stamp, minimums, judge_model)
    (out_dir / "latest.md").write_text(markdown)
    print("\n" + markdown)
    return threshold_failures(summary, minimums or {})
