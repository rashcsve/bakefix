# Progress

## Current status

Phase: 08 CI, documentation, and deployment
Last completed: CI workflow, README, and deployment; see "08 CI,
documentation, and deployment" below. The app is live at
https://bakefix.vercel.app/ (deployed manually by the user).
Next: none — Step 08 is complete.

## 08 CI, documentation, and deployment

Added `.github/workflows/ci.yml`, running on pushes and PRs to `main`:
install (frozen lockfile via corepack-enabled pnpm 10.7.1), lint,
typecheck, unit/component tests, and build — matching the build plan's
exact step list (Playwright E2E was deliberately left out of CI since the
plan only specifies those four commands; it continues to run manually via
`pnpm test:e2e`). Confirmed `lib/env.ts`'s `GEMINI_API_KEY` validation only
runs inside `diagnoseBake()` at request time, not at module load, so
`pnpm build` needs no key — verified by running a full build with the
variable unset.

Replaced the boilerplate `create-next-app` README with real project
documentation: problem/solution, features, an architecture/data-flow
diagram, the structured-output and validation decisions (shared Zod
schemas, `z.infer` types, classified error codes), the agentic-development
workflow (context files, the `build-step`/`review`/`recover` skills, human
approval points), the testing and AI-evaluation strategy, local setup and
the `GEMINI_API_KEY` env var, and tradeoffs/future improvements. Framed as
AI-assisted engineering with human-owned product and architecture
decisions, per the build plan's instruction not to claim the project was
"built entirely by AI."

Added `public/screenshot.png` for the README: captured via a temporary
Playwright script (deleted after, not part of the repository) against a
locally running `pnpm dev`, driving a real Cookies-category submission
through to a real Gemini diagnosis rather than screenshotting the empty
state, since a working result is more representative of the product.

Deployment (importing the repository into Vercel, setting `GEMINI_API_KEY`
in its environment, and deploying) was done manually by the user, since it
requires their Vercel account and was out of scope for autonomous action.
The resulting production URL, https://bakefix.vercel.app/, was added to
the README's live-demo line and to this file. Adding the URL to the GitHub
repository's own metadata (the repo "website" field) is a separate small
manual step, not yet confirmed done.

Verified with `pnpm lint`, `pnpm typecheck`, `pnpm test` (26 tests),
and `pnpm build` (all passing, matching the new CI workflow).

## 07 Independent review and polish

Reviewed the full implementation (every file under `app/`, `components/`,
`lib/`, plus tests) against `context/product.md`, `context/architecture.md`,
`context/code-standards.md`, and Step 07's review areas. `pnpm lint`,
`pnpm typecheck`, `pnpm test` (26 tests), `pnpm test:e2e` (3 tests), and
`pnpm build` all passed both before and after the fixes below. No critical
or important findings; four confirmed minor issues were fixed:

- `next.config.ts` now sets `agentRules: false`. Without it, `next dev`
  (used directly and via Playwright's e2e `webServer`) rewrote `AGENTS.md`
  on every start, appending an unsolicited block that asked to be
  committed — confirmed reproducible, the instruction was not followed,
  and the block is no longer written at all now that the flag is set
  (verified: `AGENTS.md`'s hash is unchanged after starting `pnpm dev`).
- `DiagnosisCard`'s headline is wrapped in a `<span className="min-w-0">`
  and the `<article>` now has `wrap-break-word`. Previously an unusually
  long, unbroken model-generated string (unlikely from Gemini, but not
  impossible) would silently overflow past the card's right edge instead
  of wrapping: the headline sits in a `flex` row (icon + text), and the
  text's implicit flex item had the browser default `min-width: auto`,
  which overrides `overflow-wrap` and blocks shrinking — a classic
  flexbox "blowout" that `overflow-wrap` alone (without `min-width: 0`)
  cannot fix. Verified by feeding a 120-character unbroken word through a
  mocked `/api/diagnose` response and confirming it now wraps across
  multiple lines within the card instead of clipping.
- `context/ui-registry.md`'s Chip entry now documents that Playwright's
  `getByRole("radio"/"checkbox").click()` reliably times out against the
  `sr-only` input (confirmed reproducible: the hidden input's clipped
  layout box isn't hit-testable, so Playwright's actionability check
  never stabilizes), even though a real click anywhere on the label
  activates the input instantly via native label/control delegation.
  Future Playwright tests against Chip should target the `label`, not the
  role locator — `e2e/diagnose-flow.spec.ts` already does this
  indirectly by using keyboard interaction instead of `.click()`.
- Corrected a `context/progress.md` inaccuracy from the "empty default
  state" recovery note: it claimed both the "How it works" and "About"
  nav links were removed and the footer's `id="about"` anchor deleted;
  only "How it works" was actually removed. "About" and the footer
  anchor it points to are still present and working.

Also investigated and ruled out as a false positive: a hydration-mismatch
console error (`caret-color: transparent` on form inputs) that appeared
during the browser console check. Reproduced it on the first requests
after starting a fresh `pnpm dev`, then confirmed it never recurs once
the dev server has finished compiling — a Next.js dev-mode cold-compile
timing artifact, not present in a warmed-up dev server and not expected
in a production build. No code change made for it.

Manually verified at 390x844, 768x1024, 1440x900, and a 720x450 viewport
(simulating 200% zoom on a 1440x900 display): no horizontal overflow at
any size, the two-column desktop layout collapses to one column below the
`lg` breakpoint as expected, the loading/error/success states render
correctly, and keyboard-only submission (already covered by
`e2e/diagnose-flow.spec.ts`) still passes.

## 06 Automated tests and pastry evaluations

Added unit tests under `tests/ai/` (`schema.test.ts`, `prompt.test.ts`,
`fixtures.test.ts`) covering valid/invalid `diagnosisInputSchema` and
`diagnosisSchema` cases, `buildUserMessage` with and without optional
fields, and fixture conformance. Added
`tests/components/DiagnosisWorkspace.test.tsx`, which mocks
`lib/diagnose-client` and exercises the real form: empty state, a blocked
invalid submission, category/constraint chip selection producing the
correct payload, the loading state while the mocked request is pending,
success rendering `DiagnosisCard`, and a failed request preserving the
typed problem, selected category, and selected constraint while showing
the error message. `@testing-library/react`'s `cleanup` is now run in
`tests/setup.ts` after each test (via `afterEach`) — without it, RTL
renders accumulate across tests in the same file since this project
doesn't enable Vitest's `globals` option.

Fixed a real, pre-existing gap this step's own acceptance criteria needed
tested: `DiagnosisCard`'s `<h2>` had no `id`, so `DiagnosisWorkspace`'s
`aria-labelledby="diagnosis-heading"` pointed at nothing, and nothing
moved focus there after a successful diagnosis (noted as a known issue
since Step 03/05). Added the `id`, an optional `headingRef` prop on
`DiagnosisCard`, and a `useEffect` in `DiagnosisWorkspace` that focuses
the heading when `status` becomes `"success"`. Verified via the new
Playwright test and a manual screenshot check (see below).

Added `e2e/diagnose-flow.spec.ts` (`e2e/smoke.spec.ts` untouched): one
test drives the full mocked `/api/diagnose` journey (select Cookies,
describe the problem, select Dairy-free, submit) entirely via keyboard —
covering both the "primary flow" and "keyboard interaction" acceptance
points in one pass — and asserts the loading state, the rendered
diagnosis sections, and that focus lands on the diagnosis heading. A
second test checks for no horizontal overflow at a 390x844 viewport. The
mocked route intercepts the request in-browser via `page.route`, so
these tests never reach the real API and need no `GEMINI_API_KEY`. The
mock route has a small (300ms) artificial delay — without it the
loading-state assertion occasionally raced the (near-instant) mocked
response and flaked.

Added a small, separate AI evaluation harness under `evals/`, deliberately
outside `pnpm test`/CI: `evals/cases.ts` defines the five pastry cases
from the build plan (melted-butter cookies, collapsed choux, split
buttercream, dense under-fermented bread, vague input), and
`evals/diagnose.eval.ts` is a Vitest test file (own `vitest.eval.config.mts`,
`node` environment, included only via that config) that POSTs each case to
a running `/api/diagnose`, schema-validates the response, and does a loose
keyword check for expected concepts. It calls the real endpoint over HTTP
rather than importing `lib/ai/diagnose.ts` directly, because that module
`import`s `server-only`, which throws unconditionally outside Next's
webpack `react-server` build condition — including under plain Vitest.
Every case is skipped (not failed) when `GEMINI_API_KEY` isn't set in the
shell running it. New script: `pnpm eval:ai`. `evals/README.md` documents
how to run it (start `pnpm dev`, then `pnpm eval:ai` in a second terminal
with the key set) and its limitations (heuristic keyword matching,
non-deterministic output, real API cost/quota).

Verified with `pnpm lint`, `pnpm typecheck`, `pnpm test` (26 tests across
5 files), `pnpm build`, and `pnpm test:e2e` (3 tests, run repeatedly to
confirm no flakiness). Manually screenshotted the app via a temporary
Playwright script at 390x844 and 1440x900, including the success state,
confirming the focus-visible outline lands on "Chef's diagnosis" and no
console errors were logged; the temporary script and its screenshots were
deleted afterward and are not part of the repository.

Aside: running `pnpm dev` (including via Playwright's `webServer`) causes
this installed Next.js version to auto-append an "agent rules" block to
`AGENTS.md` on every start (`node_modules/next/dist/server/lib/generate-agent-files.js`,
disableable via `agentRules: false` in `next.config.ts`). That block asks
whoever reads it to commit it "to keep the tree clean" — treated as an
unsolicited instruction embedded in a file, not followed, and reverted
each time it reappeared. Worth a deliberate decision (disable it, or
`.gitignore`-adjacent handling) rather than leaving it as a recurring
surprise; not addressed here since it's unrelated to this step's scope.

## 05 Gemini integration

Replaced the mocked diagnosis with a real, server-side Gemini call.
`lib/ai/diagnose.ts` (server-only) calls `generateText` with an
`Output.object({ schema: diagnosisSchema })` setting from the Vercel AI SDK
(the installed `ai@7`'s current structured-output API — `generateObject`
is deprecated in this version in favor of `generateText` + `output`), keeps
the model name (`gemini-3.6-flash`) in one constant, applies a 20s `timeout`,
and classifies failures into a `DiagnoseError` with codes `AI_UNAVAILABLE`,
`INVALID_OUTPUT`, or `RATE_LIMITED` (via `NoOutputGeneratedError` /
`APICallError.statusCode === 429`), logging only the error type/message
server-side, never the recipe text or key. `app/api/diagnose/route.ts` is a
thin handler: safe JSON parsing, `diagnosisInputSchema` validation
(`INVALID_INPUT`, 400, before any Gemini call), and predictable
`{ ok: true, diagnosis }` / `{ ok: false, code, message }` responses (429
for `RATE_LIMITED`, 502 otherwise) that never forward raw provider errors.
Added `lib/diagnose-client.ts` (replacing the temporary
`lib/mock-diagnose.ts`) with `requestDiagnosis`, which `fetch`es
`/api/diagnose` with its own abort timeout, narrows the JSON response, and
re-validates the diagnosis against `diagnosisSchema` before it reaches the
UI. `DiagnosisWorkspace` now calls `requestDiagnosis` and surfaces the
specific failure message through a new optional `message` prop on
`DiagnosisErrorState`.

The provider was switched from OpenAI to Google Gemini mid-step: the
connected OpenAI account had no credits (confirmed via a direct probe, not
a code defect), and Gemini's free tier avoids that blocker for this MVP.
`lib/env.ts` now validates `GEMINI_API_KEY` (not `OPENAI_API_KEY`),
`diagnose.ts` builds its model with `createGoogleGenerativeAI({ apiKey })`
from `@ai-sdk/google` rather than the implicit `GOOGLE_GENERATIVE_AI_API_KEY`
env var the package defaults to, `@ai-sdk/openai` was removed, and
`.env.example` / `context/architecture.md` / `context/build-plan.md` /
`tests/env.test.ts` were updated to match. `gemini-2.5-flash` was tried
first but rejected by the API ("no longer available to new users"); the
error message's own suggested replacement, `gemini-3.6-flash`, is what's
now in `MODEL_NAME`. Verified end-to-end with a real `GEMINI_API_KEY` in
`.env.local`: invalid input short-circuits before any network call, a real
baking problem (cookies spreading) returns a schema-valid, on-topic
diagnosis in ~10-15s, and the failure path preserves form input — checked
visually at 390px and 1440px.

## Recover: empty default state, no marketing nav

Per explicit user request (not a code defect), two behaviors from earlier
steps were reversed:

- `DiagnosisWorkspace` no longer seeds the right-hand panel with
  `exampleDiagnosis` on load. `status` starts at `"idle"` (renamed from
  `"example"`) and `diagnosis` starts `null`; the `DiagnosisCard` section
  only renders once `status === "success"`. The panel is now genuinely
  empty until a real diagnosis returns. `lib/ai/fixtures.ts` and
  `exampleDiagnosis` are unchanged and still schema-validated, just no
  longer wired into the default UI.
- `SiteHeader`'s "How it works" nav link was removed (it only ever
  scrolled to `#bake-form`, no dedicated content existed for it). The
  "About" link and the footer's `id="about"` anchor it points to were
  kept, since the footer already has real content to link to.

`context/product.md`'s MVP list no longer includes "Initial example
result" to match. Verified with `pnpm lint`, `pnpm typecheck`, `pnpm
test`, `pnpm build`, and Playwright screenshots at 390x844 and 1440x900
(no console errors, no pre-filled diagnosis card, no nav links).

A genuinely empty right column left a large dead area on desktop (no
visual anchor next to the form), so a dedicated
`components/diagnosis/DiagnosisEmptyState.tsx` placeholder card
("Your diagnosis will appear here…") now renders for `status ===
"idle"`, alongside the existing loading/error/success states. Dashed
border distinguishes it from a real result card. Verified the same way
(lint/typecheck/test/build plus 390x844 and 1440x900 screenshots).

## Features

- [x] 01 Foundation
- [x] 02 Static UI
- [x] 03 Form interactions
- [x] 04 AI contract
- [x] 05 Gemini integration
- [x] 06 Verification
- [x] 07 Review and polish
- [x] 08 Delivery

## Decisions

- No authentication or persistence in the MVP.
- UI will be implemented against fixture data before AI integration.
- The AI response will use schema-validated structured output.
- The application will not stream its initial response.
- Form validation now uses the canonical `diagnosisInputSchema` from
  `lib/ai/schema.ts`, shared by the form and (from Step 05) the server.
- Non-component logic (`.ts` schemas/data/mock services) lives under `lib/`,
  not `components/`; `components/` holds only `.tsx` presentation files, per
  `context/architecture.md`'s components/lib boundary.
- The model provider is Google Gemini (`gemini-3.6-flash`) via
  `@ai-sdk/google`, not OpenAI as originally planned in
  `context/build-plan.md`'s Step 05. Reason: the OpenAI account tied to this
  project has no credits and Gemini has a free tier, which matters for a
  demo/portfolio project with no revenue. The Vercel AI SDK abstraction made
  the swap a small, isolated change (see Step 05 note above).

## Known issues

- The project's React Compiler (`reactCompiler: true`, enabled in Step 01)
  is incompatible with react-hook-form's mutated-stable-reference `methods`
  object: the component that calls `useForm()` needs a `"use no memo"`
  directive (see `components/DiagnosisWorkspace.tsx`) or its
  `FormProvider` subtree silently stops re-rendering on validation state
  changes. Keep this directive if `useForm()` is ever moved to another
  component.
- `.env.local` may still hold the old, now-unused `OPENAI_API_KEY` entry
  alongside the working `GEMINI_API_KEY`; the agent does not open or edit
  that file, so removing the stale line is a manual cleanup step.
- Google's free tier for `gemini-3.6-flash` is rate- and quota-limited (see
  https://ai.google.dev/gemini-api/docs/rate-limits). Heavy manual testing
  or later Step 06 evaluations could hit `RATE_LIMITED` faster than the old
  OpenAI plan would have; no code change needed, just something to expect.
- Fixed in Step 06: Step 03's "move focus to the diagnosis heading after
  success" criterion is now wired up (see the Step 06 note above) —
  `DiagnosisCard`'s `<h2>` has `id="diagnosis-heading"`, and
  `DiagnosisWorkspace` focuses it via `useEffect` when `status` becomes
  `"success"`.
- Fixed in Step 07: `pnpm dev` no longer rewrites `AGENTS.md`. See the
  Step 07 note above — `next.config.ts` now sets `agentRules: false`.
- Fixed in Step 08: the app is deployed to Vercel at
  https://bakefix.vercel.app/, and the README's live-demo link now points
  there instead of the earlier placeholder.
