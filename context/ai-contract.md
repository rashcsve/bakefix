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

Prompt-injection hardening:
- The free-text fields `problem`, `recipe` and `technicalDetails` are wrapped
  in `<problem>`, `<recipe>` and `<technical_details>` tags. Optional fields
  are left out when empty.
- Inside the tags, `<` and `>` are escaped to `&lt;` and `&gt;`, so user text
  can't close a tag early. `SYSTEM_PROMPT` tells the model what the entities
  mean and to write plain `<` and `>` in its answer, so the result card never
  shows a literal `&gt;`. `&` is not escaped: after escaping, user text holds
  no real `<` or `>`, so it can't form a tag.
- Category and dietary constraints come from fixed enums and stay unwrapped.
- `SYSTEM_PROMPT` tells the model that tagged text is the baker's
  description: data, never instructions. Off-topic input gets a headline that
  says so and low confidence, and requests inside it are not followed.

## Fallback chain (`lib/ai/diagnose.ts`)

Every call gets the same schema, `SYSTEM_PROMPT`, user message,
`maxOutputTokens` and `maxRetries: 0`, and its output is parsed with
`diagnosisSchema`, whichever model answered:

1. `gemini-3.6-flash` (primary).
2. 503 or a timeout of the primary's 13s: `gemini-3.5-flash-lite`.
3. 429 and `GROQ_API_KEY` set: `openai/gpt-oss-120b` on Groq. Groq's own free
   quota is separate from Google's.

At most one of 2 and 3 runs. Error codes are the same for every provider:
429 gives `RATE_LIMITED`, bad output `INVALID_OUTPUT`, anything else
`AI_UNAVAILABLE`. The client and the evals aren't told which provider
answered.

`@ai-sdk/groq` sends the schema in strict JSON-schema mode. `diagnosisSchema`
works with it because every field is required and `safetyNote` is nullable,
not optional. Keep it that way when changing the schema.

## Output length (`lib/ai/diagnose.ts`)

Every model call passes `maxOutputTokens: 4096`, a named
constant next to the timeouts. Thinking models count their hidden reasoning
tokens toward this limit, so a tight cap cuts off the JSON and shows up as
`INVALID_OUTPUT`. If valid-diagnosis rates drop in the Python evals, raise
the cap rather than lowering it.

## Principles

- Diagnose rather than generate unrelated recipes.
- Prioritize the most likely cause first.
- Communicate uncertainty through the `confidence` field and explanation.
- Do not invent missing recipe details; name them in `missingInformation`.
- Respect dietary constraints without claiming universal allergy safety.
- Mention relevant food-safety concerns via `safetyNote`.
- Return concise conclusions, not chain-of-thought reasoning.
- Return structured, schema-validated data.
