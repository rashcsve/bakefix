import json
import statistics
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


def percentile(values: list[int], pct: float) -> int:
    if not values:
        return 0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, round(pct * (len(ordered) - 1)))]


def _rate(numerator: int, denominator: int) -> float | None:
    return round(numerator / denominator, 3) if denominator else None


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


def render_markdown(
    summary: dict[str, Any],
    base_url: str,
    stamp: str,
    minimums: dict[str, float] | None = None,
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
) -> list[str]:
    """Write latest.json and latest.md; return any threshold failures."""
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
    summary = summarize(results)
    payload = {
        "run_at": stamp,
        "base_url": base_url,
        "summary": summary,
        "results": results,
    }
    (out_dir / "latest.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    )
    markdown = render_markdown(summary, base_url, stamp, minimums)
    (out_dir / "latest.md").write_text(markdown)
    print("\n" + markdown)
    return threshold_failures(summary, minimums or {})
