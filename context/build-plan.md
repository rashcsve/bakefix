# BakeFix Implementation Plan

## Goal

Build and deploy a polished, one-page AI pastry troubleshooting application in one focused day. The project should demonstrate modern frontend engineering, a typed server boundary, structured AI output, accessibility, testing, and a controlled agentic-development workflow.

## Working Method

Project context lives in `context/`. Reusable development procedures live in project skills.

For every implementation step:

1. Start a clean Claude or Codex session from the repository root when useful.
2. Invoke the `build-step` skill with the step number.
3. Review the proposed approach before implementation proceeds.
4. Let the agent implement and run the required checks.
5. Inspect the application and `git diff` manually.
6. Invoke the `review` skill.
7. Approve only the review findings that are valid.
8. Apply targeted fixes.
9. Commit and push the completed step manually.

If a problem remains after one normal corrective attempt, invoke the `recover` skill and provide the complete raw error.

### Skill invocation

Claude Code:

```text
/build-step 01
/review
/recover
```

Codex:

```text
Use the build-step skill to implement step 01.
Use the review skill to review the current changes.
```

## Technology

- Next.js App Router
- React and strict TypeScript
- Tailwind CSS
- shadcn/ui only where it provides useful accessible primitives
- React Hook Form and Zod
- Vercel AI SDK with OpenAI
- Schema-validated structured AI output
- Vitest and Testing Library
- Playwright
- GitHub Actions
- Vercel deployment

The MVP intentionally has no authentication, database, saved history, image upload, RAG, vector store, LangChain, or autonomous application agent.

---

## Step 01 - Project Foundation

### Objective

Create a dependable development foundation without implementing the BakeFix form or AI endpoint.

### Work

- Verify Next.js App Router and strict TypeScript configuration.
- Keep the existing linter; do not migrate between ESLint and Biome without a concrete reason.
- Install the approved runtime and test dependencies.
- Load Fraunces and Inter with `next/font`.
- Define the colors and layout variables from `context/ui-tokens.md`.
- Add scripts for linting, type checking, unit tests, E2E tests, and production builds.
- Create the minimum Vitest and Playwright configuration.
- Add `.env.example` with an empty `OPENAI_API_KEY` entry.
- Verify `.env.local` is ignored by Git.
- Add one trivial test proving the test runner works.
- Update `context/progress.md` after all checks pass.

### Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git status
git diff
```

### Acceptance criteria

- The application starts and builds successfully.
- TypeScript strict mode is enabled.
- Lint, type checking, and unit tests pass.
- Fonts and design variables are configured.
- No secret is tracked.
- No product functionality has been implemented prematurely.

### Commit

```text
chore: set up project foundation
```

---

## Step 02 - Static Responsive Interface

### Objective

Build the complete visible product experience with fixture data before introducing form logic or OpenAI.

### Work

- Build the header, hero, form card, diagnosis card, and footer note.
- Add pastry categories: Cake, Cookies, Bread, Choux, Cream, and Other.
- Add the problem textarea and visual character counter.
- Add the collapsed optional recipe section.
- Add Egg-free, Dairy-free, and Gluten-free constraint controls.
- Add an initial example diagnosis.
- Add visual representations of loading and error states.
- Use semantic controls and visible focus styles.
- Keep static layout content server-rendered; introduce client boundaries only where interaction requires them later.
- Update `context/ui-registry.md` only for meaningful reusable patterns.

### Responsive targets

- Mobile: 390 x 844
- Tablet: 768 x 1024
- Desktop: 1440 x 900

### Acceptance criteria

- The desktop layout has form and diagnosis columns.
- The mobile layout stacks without horizontal overflow.
- Long diagnosis content does not break the card.
- Interactive-looking elements use accessible semantics.
- The design follows `context/ui-tokens.md` and does not resemble a generic chatbot.

### Commit

```text
feat: build responsive diagnosis interface
```

---

## Step 03 - Form Interactions and UI States

### Objective

Turn the static interface into a complete client-side interaction using a mocked asynchronous diagnosis.

### Work

- Implement form state with React Hook Form.
- Add Zod validation for category, problem, optional recipe, and constraints.
- Use semantic pressed states for selectable chips.
- Implement the optional recipe disclosure.
- Add explicit example, loading, success, and error states.
- Submit through a temporary mocked asynchronous function.
- Preserve form values after failure.
- Move focus to the diagnosis heading after success.
- Support repeat submission.

### Validation

- Category is required.
- Problem is trimmed and contains 10-1000 characters.
- Recipe is optional and limited to 5000 characters.
- A maximum of three supported constraints may be selected.

### Acceptance criteria

- Invalid input cannot be submitted.
- Validation messages are associated with their controls.
- Loading, success, and failure are visually distinct.
- Errors never clear user input.
- The complete flow works using only a keyboard.

### Commit

```text
feat: add diagnosis form interactions
```

---

## Step 04 - Typed AI Contract

### Objective

Create one shared, versioned contract between the form, server, model, and result UI.

### Work

- Create `lib/ai/schema.ts`.
- Define and export `diagnosisInputSchema`.
- Define and export `diagnosisSchema`.
- Infer `DiagnosisInput` and `Diagnosis` from the schemas instead of duplicating types.
- Move fixture data into `lib/ai/fixtures.ts` and validate it against the output schema.
- Create `lib/ai/prompt.ts` with pastry-specific system instructions and user-message construction.
- Update `context/ai-contract.md` so documentation and code agree.

### Output contract

The diagnosis contains:

- `headline`
- `explanation`
- `confidence`: high, medium, or low
- one to three ranked `causes`
- zero to four `rescueSteps`
- one to five `nextTime` recommendations
- zero to three `missingInformation` items
- nullable `safetyNote`

### Prompt principles

- Diagnose using pastry technique and the information actually provided.
- Consider ratios, temperature, mixing, aeration, emulsification, gluten development, fermentation, resting, shaping, and oven behavior.
- Do not invent missing recipe details.
- Communicate uncertainty.
- Respect dietary constraints without claiming universal allergy safety.
- Mention relevant food-safety concerns.
- Return concise conclusions, not hidden chain-of-thought reasoning.

### Acceptance criteria

- Form, server, fixture, and result UI share the same types.
- The fixture passes schema validation.
- Prompt logic is independent of React and HTTP handling.
- `context/ai-contract.md` matches the implementation.

### Commit

```text
feat: define typed diagnosis contract
```

---

## Step 05 - OpenAI Integration

### Objective

Replace the mocked diagnosis with a secure server-side OpenAI call that returns structured output.

### Data flow

```text
BakeForm
  -> POST /api/diagnose
  -> validate request
  -> lib/ai/diagnose.ts
  -> OpenAI through the Vercel AI SDK
  -> validate structured diagnosis
  -> DiagnosisCard
```

### Work

- Create `lib/ai/diagnose.ts` as a server-only module.
- Use the installed AI SDK's current structured-output API.
- Keep model selection in one server-side constant.
- Create a thin `app/api/diagnose/route.ts`.
- Parse request JSON safely and validate it before contacting OpenAI.
- Return predictable success and error shapes.
- Connect the form to `/api/diagnose` with `fetch`.
- Validate or safely narrow the response before rendering it.
- Add a reasonable request timeout.
- Log technical failures server-side without logging complete recipes or secrets.

### Error codes

- `INVALID_INPUT`
- `AI_UNAVAILABLE`
- `INVALID_OUTPUT`
- `RATE_LIMITED`

Raw provider errors must never be returned to the browser.

### Manual cases

- Cookies spread excessively.
- Choux collapsed.
- Buttercream split.
- Input is vague and lacks necessary detail.
- Request input is invalid.
- API credentials are unavailable or invalid.

### Acceptance criteria

- A real baking problem produces a valid diagnosis.
- Invalid input never contacts OpenAI.
- Provider failure preserves the form data and shows a useful message.
- The API key is present only in server-side configuration.
- Model-generated HTML is never rendered.
- Production build passes.

### Commit

```text
feat: integrate structured AI diagnosis
```

---

## Step 06 - Automated Tests and Pastry Evaluations

### Objective

Prove that deterministic application behavior is reliable and create a small domain evaluation set for variable AI behavior.

### Unit and component tests

- Valid and invalid input schema cases.
- Valid and invalid output schema cases.
- Fixture conformance.
- Prompt construction with and without recipe and constraints.
- Category and constraint selection.
- Invalid submission.
- Loading and successful result rendering.
- Failure preserving user input.

Avoid tests that only assert Tailwind class strings.

### Playwright journey

Mock `/api/diagnose` and verify:

1. Open the page.
2. Select Cookies.
3. Describe the failure.
4. Select Dairy-free.
5. Submit.
6. Observe the loading state.
7. Receive a mocked diagnosis.
8. Verify the diagnosis sections and result focus.

Also check mobile overflow and keyboard interaction.

### AI evaluation cases

Create at least five pastry cases:

- Cookies made with nearly melted butter spread into a sheet.
- Choux collapses after leaving the oven.
- Buttercream splits after adding cold ingredients.
- Bread is dense with weak fermentation evidence.
- The user provides insufficient information.

Each real-model evaluation must validate the schema and check expected concepts. Paid model evaluations run manually, not in normal CI.

### Acceptance criteria

- Unit and component tests pass.
- The primary Playwright flow passes with a mocked API.
- CI does not require or spend an OpenAI API key.
- Evaluation limitations are documented.

### Commit

```text
test: cover diagnosis flow and AI contract
```

---

## Step 07 - Independent Review and Polish

### Objective

Review the completed product as a senior engineer and correct confirmed problems without expanding scope.

### Review areas

- Server and client component boundaries
- TypeScript safety
- Runtime validation
- Secret handling
- Error classification and recovery
- Prompt injection boundaries
- Unsupported certainty or unsafe food claims
- Keyboard interaction and focus management
- Semantic HTML and accessible names
- Mobile, tablet, and desktop layout
- Long and empty content states
- Loading layout shift
- Unused dependencies and abstractions
- Accuracy of project context

### Manual checks

- Complete the flow without a mouse.
- Test at 200% zoom.
- Test narrow and wide viewports.
- Inspect the browser console.
- Inspect the network response without exposing credentials.
- Confirm `.env.local` is ignored and absent from Git history.

### Acceptance criteria

- No critical review findings remain.
- Confirmed important findings are fixed or documented.
- Core Web UI remains responsive and usable.
- All automated checks pass after fixes.

### Commit

Choose the commit matching the actual work:

```text
fix: improve accessibility and error handling
```

or:

```text
style: polish responsive interface
```

---

## Step 08 - CI, Documentation, and Deployment

### Objective

Make the repository easy to evaluate, safe to change, and available as a live portfolio project.

### Continuous integration

Add `.github/workflows/ci.yml` to run on pushes and pull requests:

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The production build and test suite must not require a real OpenAI API key.

### README

Include:

1. Product screenshot and live demo link
2. Problem and solution
3. Core features
4. Architecture and data flow
5. Structured-output and validation decisions
6. Agentic-development workflow
7. Testing and AI evaluation strategy
8. Local setup and environment variables
9. Tradeoffs and future improvements

Describe the project as AI-assisted engineering with human-owned product, domain, architecture, and review decisions. Do not claim the project was simply "built entirely by AI."

### Deployment

- Import the GitHub repository into Vercel.
- Configure `OPENAI_API_KEY` in the deployment environment.
- Deploy and test the live application.
- Test the live mobile experience on a real device.
- Add the production URL to GitHub repository metadata and the README.

### Commits

```text
ci: validate application on pull requests
docs: document architecture and agentic workflow
```

Deployment requires an additional commit only if deployment-specific files change.

---

## Final Definition of Done

- The complete user flow works locally and in production.
- Model input and output are runtime validated.
- Secrets remain server-side and outside Git.
- Loading and provider failures are handled gracefully.
- The interface is responsive and keyboard accessible.
- Unit tests and the mocked E2E flow pass.
- A small pastry-domain evaluation set exists.
- GitHub Actions passes.
- The README explains architecture, tradeoffs, and the agentic workflow.
- Every commit represents one coherent, verified implementation step.

## Interview Ownership

Be prepared to explain these files without agent assistance:

- `components/form/BakeForm.tsx`
- `lib/ai/schema.ts`
- `lib/ai/prompt.ts`
- `lib/ai/diagnose.ts`
- `app/api/diagnose/route.ts`

Key interview decisions:

- Structured output creates a stable UI contract.
- No database was required to validate the MVP's core value.
- A single bounded inference did not justify LangChain or a multi-agent runtime.
- Pastry expertise informed prompt rules and evaluation cases.
- Agent-generated changes were controlled through repository context, reusable skills, automated checks, browser verification, and human review.
