# Progress

## Current status

Phase: 05 Gemini integration
Last completed: Replaced the mocked diagnosis with a real, server-side
Gemini call. `lib/ai/diagnose.ts` (server-only) calls `generateText` with
an `Output.object({ schema: diagnosisSchema })` setting from the Vercel AI
SDK (the installed `ai@7`'s current structured-output API — `generateObject`
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
Next: 06 Automated tests and pastry evaluations

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
- `SiteHeader`'s "How it works" / "About" nav links were removed (they
  only ever scrolled to `#bake-form` and the footer's `#about` anchor, no
  dedicated content existed for them). The now-unused `id="about"` and
  `scroll-mt-20` were removed from `SiteFooter`.

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
- [ ] 06 Verification
- [ ] 07 Review and polish
- [ ] 08 Delivery

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
- Step 03's "move focus to the diagnosis heading after success" acceptance
  criterion was never wired up: `components/diagnosis/DiagnosisCard.tsx`'s
  `<h2>` has `tabIndex={-1}` but no `id`, and nothing calls `.focus()` on it
  after a successful submission. Carried forward rather than fixed in Step
  05 to keep that step's diff scoped to the AI integration; address in
  Step 07 (review and polish) or whichever step touches focus management.
