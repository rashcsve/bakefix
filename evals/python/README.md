# Python dataset evals

A larger, real-world complement to the five hand-written cases in
`evals/cases.ts`. Baking-failure questions from
[Seasoned Advice](https://cooking.stackexchange.com) are parsed into BakeFix
inputs, sent to a running `/api/diagnose`, and scored with deterministic
checks (no LLM judge). It is never part of `pnpm test` or the main CI job.
The live run happens in its own GitHub workflow (see
[Automated runs](#automated-runs)) or by hand.

## Setup

Requires [uv](https://docs.astral.sh/uv/). From `evals/python/`:

```bash
uv sync
uv run pytest        # offline unit tests for parsing, scoring and reporting
uv run ruff check .
uv run ruff format --check .
```

## Pipeline

1. `uv run python -m bakefix_evals.fetch_raw` downloads questions into
   `data/raw/seasoned_advice.json`, using the public Stack Exchange API
   with no key. You only need this to refresh the data, because the output
   is committed.
2. `uv run python -m bakefix_evals.parse_dataset` keeps first-person "my
   bake failed" questions, maps them to a category and constraints,
   validates them against the Pydantic mirror of `lib/ai/schema.ts`, and
   writes `data/cases.json`. Every dropped question goes to
   `data/rejects.json` with a reason. It also appends the hand-written
   cases in `data/curated_cases.json`, which cover each dietary constraint.
   Running this twice produces identical output, and CI fails if the
   committed `data/` is stale.
3. Start the app with a real `GEMINI_API_KEY` (`pnpm dev`), then run:

   ```bash
   uv run python -m bakefix_evals.run_evals             # 12 cases, see below
   uv run python -m bakefix_evals.run_evals --limit 0   # all cases
   ```

   The default run picks cases round-robin across categories and dietary
   constraints, so even 12 cases cover every category and constraint.
   Use `--base-url` (or `EVAL_BASE_URL`) to target a deployment. Reports are
   written to `reports/latest.{json,md}`, which is git-ignored.

   Add `--min-success`, `--min-calibration` or `--min-constraint` (rates from
   0 to 1) to make the run exit with status 1 when a score falls below them.
   A gated check with no cases to measure also fails.

## Automated runs

`.github/workflows/ai-evals.yml` runs the live evals in three situations:

| Trigger | Evaluates | Needs the `GEMINI_API_KEY` repo secret |
| --- | --- | --- |
| PR to `main` touching `lib/ai/**`, `lib/constants.ts`, `lib/env.ts`, `app/api/diagnose/**`, `package.json` or `pnpm-lock.yaml` | this branch, built and started inside the job | yes |
| Every Monday 06:00 UTC | production, `https://bakefix.vercel.app` | no (production has its own key) |
| "Run workflow" button (Actions tab) | this branch, or any `base_url` you enter | only for this branch |

Each run uses 18 cases, which takes about 4 minutes at the free-tier pace.
It fails if fewer than 85% of diagnoses are valid or fewer than 70% are
calibrated. These are starting values; tune them in the workflow once a few
runs show the normal range. Constraint compliance is reported but not
gated: an 18-case run has only 6 constrained cases, so a single misjudged
answer would decide the result. The report appears on the run's summary
page and is uploaded as the `ai-eval-report` artifact.

The key is passed only to the step that starts the server, so dependency
install scripts and other actions never see it. GitHub withholds secrets
from PRs opened from forks or by Dependabot; those runs are skipped with a
warning. Anywhere else, a missing secret fails the run. Only one run
happens at a time, so runs never compete for the rate limit.

## Checks

| Check | Meaning |
| --- | --- |
| Valid diagnosis | The response is `ok` and matches the output schema. |
| Calibrated | Not `high` confidence while also listing missing information. |
| Constraints respected | Advice for an Egg-/Dairy-/Gluten-free case does not recommend a forbidden ingredient. |
| Safety note included | Informational only; this is not pass/fail. |
| Latency p50 / p95 | Time for the final attempt only; 429 backoff is excluded. |

## Limitations

- **Cost.** Each case is one real Gemini call and counts against the free
  tier's rate limits (about 5 requests a minute). Requests run one at a
  time, at least 13 seconds apart; change this with `--min-interval`. 429s
  and network errors are retried with backoff. The default run is capped at
  12 cases.
- **Constraint coverage is modest.** 14 of the 68 cases carry a dietary
  constraint (3 parsed, 11 hand-written), so the constraint figure is an
  indication, not a precise measurement.
- **The constraint check is keyword-based.** An ingredient counts as safe
  only when a negation comes before it in the same clause ("do not add
  butter", but not "no more than 2 eggs"), it is the object of a swap verb
  rather than the replacement ("replace the butter with oil", but not
  "replace the oil with butter"), a
  free-from or plant qualifier sits right before it ("coconut cream"), or
  "-free" or "substitute" comes right after it ("egg-free"). Phrasing
  outside these patterns can be misjudged in either direction. For example,
  "do not overmix and add eggs" passes, and "substitute butter for
  margarine" counts as safe. Gluten-free checks look for wheat and named
  wheat flours, not plain "flour", because gluten-free flour is also
  "flour"; "add more flour" therefore passes.
- **Calibration is a proxy.** It catches self-contradiction, not whether
  the confidence level is actually right.
- **The safety note is not scored.** The prompt asks for one only when
  there is a food-safety risk, which a deterministic check cannot detect.
- **Parsing is heuristic.** Regex filters decide which questions describe a
  failed bake. Check `rejects.json` when you change them.
- **Training-data overlap.** `fetch_raw` takes the most-upvoted
  questions, which are the posts most likely to be in Gemini's training
  data. Scores on parsed cases may partly reflect memorised answers, so
  read them as an upper bound. The hand-written cases are not affected.
- **Non-determinism.** As with the TypeScript evals, treat a single bad run
  as noise and a repeated failure as a signal. This applies to the automated
  workflow too: rerun a failed job before treating it as a regression.

## Data license

`data/` contains user posts from Seasoned Advice, licensed
[CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/) by their
authors. Each record keeps its author, link, and license version for
attribution. The posts were adapted: HTML removed, title and body joined,
and long posts cut to 1000 characters. The hand-written cases in
`curated_cases.json` are original (`license: "original"`).
