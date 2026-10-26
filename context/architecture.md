# Architecture

## Stack

- Next.js App Router
- React
- Strict TypeScript
- Tailwind CSS
- shadcn/ui selectively
- React Hook Form
- Zod
- Vercel AI SDK
- Google Gemini
- Vitest and Testing Library
- Playwright
- Vercel deployment

Use versions installed by the project rather than documenting version
numbers that can become outdated.

## System flow

1. The browser renders the BakeFix form.
2. The user submits validated input to POST /api/diagnose.
3. The route checks the per-IP rate limit, then validates the request.
4. The route calls the server-only diagnoseBake function.
5. Gemini produces a structured diagnosis.
6. The result is validated against the output schema.
7. The UI renders the typed result.

## Boundaries

### app/

Owns routes, layouts, page composition and HTTP handling.

API route handlers must remain thin. They may validate requests, call domain
functions and convert their result into an HTTP response.

### components/

Owns presentation and user interaction.

Components must not call Gemini directly or access server secrets.

### lib/ai/

Owns model configuration, prompt construction, input/output schemas and
diagnosis orchestration. `diagnose.ts` names the primary model and a
fallback model, tried once when the primary is overloaded (503) or runs out
of its own 13s. Both calls share one 20s overall deadline, so the fallback
gets whatever is left. A 404 logs the model as not found (likely retired).

This folder must not import React components.

### lib/

Owns environment validation and shared utilities.

`rate-limit.ts` (server-only) limits `/api/diagnose` to 5 requests per IP per
60s (sliding window, Upstash Redis, key prefix `bakefix:diagnose`). The IP is
the first `x-forwarded-for` entry, or `"unknown"`. This trusts Vercel, which
overwrites `x-forwarded-for` with the real client IP; on another host a client
could spoof it. Locally every request shares one bucket, so with the Upstash
vars set the 6th quick submit in a minute is blocked. It fails open: without
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` it warns once and allows;
if only one is set or the URL is invalid it logs once and allows; on a Redis
error or a 1.5s timeout it logs and allows. A blocked request gets
`RATE_LIMITED` with status 429.

### tests/

Owns unit and component tests.

### e2e/

Owns browser-level user-flow tests.

### evals/

Owns the manual, pastry-domain AI evaluation set. Runs against a live
`/api/diagnose` over HTTP rather than importing `lib/ai/diagnose.ts`
directly, because that module's `import "server-only"` throws
unconditionally outside Next's webpack `react-server` build condition
(including under plain Vitest). Excluded from `pnpm test`/CI via its own
`vitest.eval.config.mts` and run manually with `pnpm eval:ai`.

`evals/python/` is a separate, uv-managed Python package. It turns
Seasoned Advice questions into BakeFix inputs and scores live
`/api/diagnose` responses with deterministic checks. It uses the same HTTP
boundary as the TypeScript evals. Its Pydantic models mirror
`lib/ai/schema.ts` and `lib/constants.ts`, and its tests fail if the enums
or field limits drift. It is excluded from Biome (`evals/python/data`) and
from `pnpm test`. CI runs its lint, offline tests and a data-freshness check
in a separate `python-evals` job that never calls Gemini. Live runs happen
only in `.github/workflows/ai-evals.yml`:
- on PRs that touch `lib/ai/**`, `lib/constants.ts`, `lib/env.ts`,
  `app/api/diagnose/**`, `package.json` or `pnpm-lock.yaml`, against the
  branch built in the job, using the `GEMINI_API_KEY` repository secret
  (passed only to the step that starts the server)
- weekly, against production
- on demand

Each run is gated on the valid-diagnosis and calibration rates.

## Invariants

- Gemini is called only from server-side code.
- GEMINI_API_KEY and the Upstash vars never use the NEXT_PUBLIC_ prefix.
- Every external input is validated with Zod.
- Every AI response is schema validated.
- The UI never renders arbitrary AI-generated HTML.
- Server Components are used by default.
- Client Components are limited to interactive boundaries.
- No database or authentication is introduced in the MVP.
- No provider-specific code is placed in React components.
