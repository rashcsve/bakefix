# AI Contract

The input schema, output schema and model instructions live in `lib/ai/`
and are shared by the form, the server, the fixture data and the result UI.

## Input contract (`lib/ai/schema.ts`, `diagnosisInputSchema`)

- `category`: one of `lib/constants.ts`'s `PASTRY_CATEGORIES`.
- `problem`: trimmed, 10-1000 characters.
- `recipe`: optional, trimmed, up to 5000 characters.
- `technicalDetails`: optional, trimmed, up to 1000 characters.
- `constraints`: up to three values from `DIETARY_CONSTRAINTS`
  (`Egg-free`, `Dairy-free`, `Gluten-free`).

`DiagnosisInput` is inferred from this schema and reused by the form
(`react-hook-form` + `zodResolver`) and, from Step 05, the API route.

## Output contract (`lib/ai/schema.ts`, `diagnosisSchema`)

- `headline`: string.
- `explanation`: string.
- `confidence`: `"high" | "medium" | "low"`.
- `causes`: one to three ranked strings.
- `rescueSteps`: zero to four strings.
- `nextTime`: one to five strings.
- `missingInformation`: zero to three strings.
- `safetyNote`: string or `null`.

`Diagnosis` (and the `Confidence` alias) are inferred from this schema and
reused by the fixture, the mocked diagnosis function and `DiagnosisCard`.

## Fixture (`lib/ai/fixtures.ts`)

`exampleDiagnosis` is parsed through `diagnosisSchema` at module load, so it
fails fast if it ever drifts from the output contract.

## Prompt (`lib/ai/prompt.ts`)

`SYSTEM_PROMPT` and `buildUserMessage(input)` construct the model instructions
and user message from a validated `DiagnosisInput`. This module has no
dependency on React or HTTP handling, so it can be exercised in isolation and
reused unchanged by the Step 05 server integration.

## Principles

- Diagnose rather than generate unrelated recipes.
- Prioritize the most likely cause first.
- Communicate uncertainty through the `confidence` field and explanation.
- Do not invent missing recipe details; name them in `missingInformation`.
- Respect dietary constraints without claiming universal allergy safety.
- Mention relevant food-safety concerns via `safetyNote`.
- Return concise conclusions, not chain-of-thought reasoning.
- Return structured, schema-validated data.
