# Progress

## Current status

Phase: 03 Form interactions
Last completed: Wired the static interface to React Hook Form + Zod
validation (category, problem, recipe, constraints), added a live
DiagnosisWorkspace client boundary that drives example/loading/success/error
states through a temporary mocked async diagnosis function, preserves form
values on failure, supports repeat submission, and moves focus to the
diagnosis heading on success.
Next: 04 Typed AI contract

## Features

- [x] 01 Foundation
- [x] 02 Static UI
- [x] 03 Form interactions
- [ ] 04 AI contract
- [ ] 05 OpenAI integration
- [ ] 06 Verification
- [ ] 07 Review and polish
- [ ] 08 Delivery

## Decisions

- No authentication or persistence in the MVP.
- UI will be implemented against fixture data before OpenAI integration.
- The AI response will use schema-validated structured output.
- The application will not stream its initial response.
- Form validation lives in a temporary `lib/schemas/bake-form.ts`
  local to Step 03; Step 04 will introduce the canonical
  `lib/ai/schema.ts` contract and this file should be retired in favor of it.
- The mocked diagnosis (`lib/mock-diagnose.ts`) resolves with
  fixture data after a delay and deterministically rejects when the problem
  text contains "trigger error", so the error state can be exercised
  manually; it will be replaced by the real `/api/diagnose` call in Step 05.
- Non-component logic (`.ts` schemas/data/mock services) lives under `lib/`,
  not `components/`; `components/` holds only `.tsx` presentation files, per
  `context/architecture.md`'s components/lib boundary.

## Known issues

- The project's React Compiler (`reactCompiler: true`, enabled in Step 01)
  is incompatible with react-hook-form's mutated-stable-reference `methods`
  object: the component that calls `useForm()` needs a `"use no memo"`
  directive (see `components/DiagnosisWorkspace.tsx`) or its
  `FormProvider` subtree silently stops re-rendering on validation state
  changes. Keep this directive if `useForm()` is ever moved to another
  component.
