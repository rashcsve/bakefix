# Groq schema limits and answering model

## Goal

Get the Python eval to at least 90% valid diagnoses (build plan 0.2) and make
the baseline show which model answered each case.

The 2026-10-27 full run (68 cases) was 88% valid. All 8 failures came from
Groq (`openai/gpt-oss-120b`): its strict JSON-schema mode returned
400 `json_validate_failed` because a list was too long (`causes` 4>3 ×5,
`missingInformation` 4>3 ×2, `rescueSteps` 5>4 ×1). The catch-all in
`lib/ai/diagnose.ts` mapped them to `AI_UNAVAILABLE`. `SYSTEM_PROMPT` never
states the list limits. Gemini answered 22 cases with 0 failures; Groq
answered 46 after Gemini's quota ran out, and the report couldn't show that.

## Scope

1. `SYSTEM_PROMPT` states the maximum length of each list.
2. A Groq 400 `json_validate_failed` maps to `INVALID_OUTPUT` (status 502),
   with a log line naming the model.
3. `POST /api/diagnose` sets an `X-BakeFix-Model` response header with the
   last model called, on success and on errors where a model was called.
4. The Python eval runner records the header per case, and the report shows
   how many cases each model answered and failed.
5. `context/ai-contract.md` documents the header and the new error mapping.

## Out of scope

- Retrying Groq or salvaging `failed_generation`. Measure the prompt change
  first. (Measured: still 88%, 8 Groq one-item overruns. Owner then approved
  one Groq retry on `json_validate_failed`; salvaging stays out.)
- Changing `diagnosisSchema`, its limits, models, timeouts or the fallback
  order (🔴 model choice).
- Changing the JSON response body. The `{ ok, … }` contract is unchanged.
- Showing the model in the UI. The client ignores the header.
- False positives in the dietary-constraint scorer (separate spec).
- Run metadata, baselines and comparisons (build plan Module 2).

## Files & interfaces

| File | Zone | Change |
| --- | --- | --- |
| `lib/ai/prompt.ts` | 🟢 | One rule listing the limits: causes ≤3, rescueSteps ≤4, nextTime ≤5, missingInformation ≤3. |
| `lib/ai/diagnose.ts` | 🟡 error handling | Classify Groq schema rejections; return and attach the model. |
| `app/api/diagnose/route.ts` | 🟡 | Set `X-BakeFix-Model`. |
| `evals/python/src/bakefix_evals/run_evals.py`, `report.py` | 🟢 (eval code) | Record and summarize the model. |
| `context/ai-contract.md` | docs | Header and mapping. |
| `tests/ai/prompt.test.ts`, `tests/ai/diagnose.test.ts`, `tests/api/diagnose-route.test.ts`, `evals/python/tests/test_run_evals.py` | 🟢 | Tests. |

No dependency, env, workflow or `evals/python/data/**` changes.

**`diagnoseBake`**

```ts
export type DiagnoseResult = { diagnosis: Diagnosis; model: string };
export async function diagnoseBake(input: DiagnosisInput): Promise<DiagnoseResult>;

export class DiagnoseError extends Error {
  readonly code: DiagnoseErrorCode;
  readonly model: string | null; // last model called; null if none (missing key)
}
```

**Groq schema rejection:** an `APICallError` (bare or in `RetryError`) with
`statusCode === 400` whose `responseBody` contains `json_validate_failed`.
The SDK's Groq error schema drops `error.code`, so the raw body is the only
place it appears. Log: `diagnoseBake: <model> output failed schema validation`
plus the error message (it names the failing field, never user input).

**Header:** `X-BakeFix-Model: <model id>`, e.g. `gemini-3.6-flash`,
`gemini-3.5-flash-lite`, `openai/gpt-oss-120b`.

| Response | Header |
| --- | --- |
| 200 | model that answered |
| 502 / 429 from a `DiagnoseError` with `model` set | last model called |
| 502 for a missing key (`model: null`), unexpected non-`DiagnoseError` | none |
| 400 invalid input, 429 from `lib/rate-limit.ts` | none |

It reveals only the model name, which is public in this repo. No secrets, no
user input.

**Eval result per case:** `"model": str | None` (header value, `None` when
absent). Summary gains `"models": {model: {"cases": n, "ok": n}}`; the
markdown report adds one table "Answered by" (model, cases, valid).

## Tasks

### 1. State list limits in the prompt ✅ Done

**Blocked by:** none.

- `SYSTEM_PROMPT` has one rule giving the four maximums.
- `tests/ai/prompt.test.ts` reads each maximum from `diagnosisSchema` and
  asserts the prompt states it with the field name, so the two can't drift.
- Existing prompt tests unchanged and passing.

### 2. Map Groq schema rejections to `INVALID_OUTPUT` ✅ Done

**Blocked by:** none.

- First, a characterization test in `tests/ai/diagnose.test.ts` (Groq
  fallback block): Gemini 429, then Groq rejects with a 400 whose
  `responseBody` contains `json_validate_failed` → currently
  `AI_UNAVAILABLE`. Run it green against the current code, then change the
  expectation and the code.
- After: that case gives `INVALID_OUTPUT`, also when wrapped in `RetryError`.
- Logs one line naming `openai/gpt-oss-120b` and "failed schema validation".
- A 400 without `json_validate_failed` stays `AI_UNAVAILABLE` (test).
- A 400 `json_validate_failed` from Gemini maps the same way (the check is
  not Groq-specific).
- All other existing classification tests unchanged and passing.

### 3. Report the answering model in a response header ✅ Done

**Blocked by:** 2 (same file).

- Characterization tests first in `tests/api/diagnose-route.test.ts` for
  current statuses and bodies (200, 502, 429 provider, 429 limiter, 400), if
  not already covered.
- `diagnoseBake` returns `{ diagnosis, model }` for each path: primary,
  Gemini fallback, Groq. Existing tests that assert `toEqual(exampleDiagnosis)`
  assert `.diagnosis` instead and gain a `.model` assertion (same strength,
  new shape).
- `DiagnoseError.model` is the last model called, `null` for a missing key.
- Route sets `X-BakeFix-Model` per the table above; JSON bodies byte-identical
  to before.
- `lib/diagnose-client.ts` and components unchanged; `pnpm test:e2e` passes.

### 4. Record the model in the eval report ✅ Done

**Blocked by:** 3.

- `call_api` returns the `X-BakeFix-Model` header; each result has `model`.
- `summarize` adds `models`; `render_markdown` adds the "Answered by" table.
- `tests/test_run_evals.py`: header present, header absent (`None`), summary
  counts per model including failures.
- `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .` pass.

### 5. Update the AI contract ✅ Done

**Blocked by:** 2, 3.

- `context/ai-contract.md` Fallback chain: replace "The client and the evals
  aren't told which provider answered" with the header rule; add that a
  schema rejection from strict JSON mode is `INVALID_OUTPUT`.
- Prompt section mentions the list-limit rule.

## Testing

- Offline only: `pnpm typecheck`, `pnpm test`, `pnpm lint`, and the Python
  checks above. No live model calls.
- Yellow files: characterization tests before changing behaviour (task 2
  for `diagnose.ts`, task 3 for `route.ts`).
- No test is deleted, skipped or weakened; shape changes in task 3 keep every
  existing assertion on the diagnosis.

## End-to-end check

Owner runs (spends Gemini and Groq quota):

```
UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN= pnpm dev
cd evals/python && uv run python -m bakefix_evals.run_evals --limit 0
```

Pass: valid diagnoses ≥ 90%; "Answered by" table present with per-model
counts; any remaining Groq failures show as `INVALID_OUTPUT`, not
`AI_UNAVAILABLE`. That run is the 0.2 baseline.
