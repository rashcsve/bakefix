# Progress

## Current status

Phase: 04 AI contract
Last completed: Introduced the canonical AI contract in `lib/ai/`:
`schema.ts` (`diagnosisInputSchema`/`DiagnosisInput` and
`diagnosisSchema`/`Diagnosis`), `fixtures.ts` (the example diagnosis,
validated against the output schema at module load), and `prompt.ts`
(pastry-specific system instructions and `buildUserMessage`, independent of
React and HTTP handling). Retired the temporary
`lib/schemas/bake-form.ts` and `lib/example-diagnosis.ts` and moved every
consumer (`DiagnosisWorkspace`, `BakeForm`, `CategoryField`,
`ConstraintField`, `RecipeDisclosure`, `mock-diagnose`, `DiagnosisCard`) onto
the shared types.
Next: 05 OpenAI integration

## Features

- [x] 01 Foundation
- [x] 02 Static UI
- [x] 03 Form interactions
- [x] 04 AI contract
- [ ] 05 OpenAI integration
- [ ] 06 Verification
- [ ] 07 Review and polish
- [ ] 08 Delivery

## Decisions

- No authentication or persistence in the MVP.
- UI will be implemented against fixture data before OpenAI integration.
- The AI response will use schema-validated structured output.
- The application will not stream its initial response.
- Form validation now uses the canonical `diagnosisInputSchema` from
  `lib/ai/schema.ts`, shared by the form and (from Step 05) the server.
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
