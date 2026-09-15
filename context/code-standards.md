# Code Standards

## TypeScript

- Strict mode is required.
- Do not use any.
- Use unknown and narrow it when a value is untrusted.
- Infer shared types from Zod schemas when possible.
- Use const unless reassignment is necessary.
- Handle all promises.

## React and Next.js

- Use the App Router only.
- Components are Server Components by default.
- Add "use client" only when browser interactivity requires it.
- Keep business logic outside route handlers and components.
- Do not introduce global state for local form state.
- Avoid effects when state can be derived or updated through events.

## Components

- Prefer named exports.
- Keep components focused on one meaningful responsibility.
- Avoid premature generic abstractions.
- Use semantic HTML before custom ARIA.
- Every form control must have an accessible name.
- Keyboard focus must be visible.

## API and AI

- Validate request bodies before processing.
- Return predictable success and error shapes.
- Do not expose raw errors to users.
- Keep model instructions in lib/ai/prompt.ts.
- Keep model selection in lib/ai/diagnose.ts.
- Never interpolate untrusted input into system instructions.
- Never render model-generated HTML.

## Dependencies

- Add a dependency only when it provides clear value.
- Check its current official documentation before using it.
- Prefer platform and framework capabilities over unnecessary libraries.

## Scope

- Implement one build-plan step at a time.
- Do not add unrequested features.
- Do not refactor unrelated code.
- Keep the one-day project constraint in mind.
