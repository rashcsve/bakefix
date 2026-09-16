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
3. The route validates the request.
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
diagnosis orchestration.

This folder must not import React components.

### lib/

Owns environment validation and shared utilities.

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

## Invariants

- Gemini is called only from server-side code.
- GEMINI_API_KEY never uses the NEXT_PUBLIC_ prefix.
- Every external input is validated with Zod.
- Every AI response is schema validated.
- The UI never renders arbitrary AI-generated HTML.
- Server Components are used by default.
- Client Components are limited to interactive boundaries.
- No database or authentication is introduced in the MVP.
- No provider-specific code is placed in React components.
