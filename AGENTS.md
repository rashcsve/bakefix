# Project: BakeFix
Diagnoses failed bakes with Gemini. Full-stack Next.js app: React UI, an API route (`app/api/diagnose`) that calls Gemini on the server, and a Python eval package (`evals/python`).
Next.js 16 App Router, React 19 + React Compiler, TypeScript strict, Zod, Tailwind 4, pnpm.

## Commands
- Dev: `pnpm dev`
- Test all: `pnpm test` · one file: `pnpm test tests/env.test.ts` · e2e: `pnpm test:e2e`
- Typecheck: `pnpm typecheck`
- Lint / format: `pnpm lint` · `pnpm lint:fix` (Biome, no ESLint/Prettier)
- Python evals (offline): `cd evals/python && uv run pytest && uv run ruff check .`
- Live AI evals spend Gemini quota: `pnpm eval:ai` only when asked.

## Context
Background docs live in `context/` (product, architecture, code-standards, ai-contract, ui-tokens, ui-registry).
Read the relevant ones before implementing. New features are specified in `docs/specs/<feature>.md` (`/spec`, then `/next-task`).
`context/build-plan.md` covers the finished MVP steps; `/build-step` is only for those.

## Conventions
- API responses are `{ ok: true, … }` or `{ ok: false, code, message }`. Status: 400 invalid input, 429 rate limited, 502 AI failure. Never send raw errors to the client.

## Follow these examples
- Form: `components/form/BakeForm.tsx`
- Page state + data flow: `components/DiagnosisWorkspace.tsx`
- Client fetch: `lib/diagnose-client.ts`
- API route (thin): `app/api/diagnose/route.ts`
- Server logic and error mapping: `lib/ai/diagnose.ts`
- AI schema: `lib/ai/schema.ts`; prompt only in `lib/ai/prompt.ts`; model only in `lib/ai/diagnose.ts`

## Gotchas
- The component calling `useForm()` needs `"use no memo"`, or the React Compiler stops form re-renders.
- `lib/ai/diagnose.ts` imports `server-only`, so it can't load under plain Vitest; evals go over HTTP.
- Client timeout (25s) must stay above the server timeout (20s).
- Python models in `evals/python` mirror `lib/ai/schema.ts` and `lib/constants.ts`; their tests fail on drift.
- Gemini free tier is rate-limited. With `GROQ_API_KEY` set, a Gemini 429 falls back to Groq once; without it, expect `RATE_LIMITED` during heavy manual testing.
- With the Upstash vars set locally, every request shares one rate-limit bucket: the 6th quick submit in a minute gets 429 from `lib/rate-limit.ts`, not from Gemini.

## Zones
- 🟢 Green (work freely, tests required): `components/**`, `lib/ai/schema.ts`, `lib/ai/prompt.ts`, `lib/ai/fixtures.ts`, `tests/**`, `e2e/**`
- 🟡 Yellow (write characterization tests BEFORE changing): `app/api/diagnose/route.ts`, `lib/diagnose-client.ts`, `lib/rate-limit.ts`, error/timeout handling in `lib/ai/diagnose.ts`
- 🔴 Red (ask before every change): `lib/env.ts`, model choice in `lib/ai/diagnose.ts`, `.github/workflows/**`, `evals/python/data/**`, dependencies

## Workflow
- Explore read-only first; for bigger changes, propose a plan and wait.
- Small steps. One task at a time. Do not expand scope.
- Tests first for new behaviour. Never delete, skip or weaken a test to make it pass — ask.
- After changes run typecheck + relevant tests + lint; fix root causes (no `any`, no `@ts-ignore`, no disabled lint rules).
- Show evidence: the command you ran and its output.
- If a problem remains after one normal fix attempt, use `/recover`. Review with `/review` before committing.
- Don't add new dependencies without asking; check they exist and are maintained.
- Never read or print `.env*` or secrets. `GEMINI_API_KEY` stays server-only, never `NEXT_PUBLIC_`.
- If what you find contradicts the plan, stop and say so.
- Don't commit or push unless asked. Update `context/progress.md` when a feature ships.

## Definition of done
Acceptance criteria pass; lint, typecheck and relevant tests pass; UI changes checked at mobile and desktop widths.
