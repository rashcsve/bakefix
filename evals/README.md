# AI evaluations

A small, pastry-domain evaluation set for the real Gemini model. These are
integration checks against a running server, not part of `pnpm test`, and
they are never required by CI.

## Running

1. Start the app with a real `GEMINI_API_KEY` configured (`.env.local`):
   ```bash
   pnpm dev
   ```
2. In a second terminal, with `GEMINI_API_KEY` set in that shell too:
   ```bash
   pnpm eval:ai
   ```

Each case in `cases.ts` POSTs to `/api/diagnose`, checks the response
against `diagnosisSchema`, and does a loose keyword check for concepts the
diagnosis should mention. Cases run against whatever server is listening at
`EVAL_BASE_URL` (default `http://localhost:3000`).

If `GEMINI_API_KEY` is not set in the shell running `pnpm eval:ai`, every
case is skipped rather than failed.

## Limitations

- Keyword matching is a coarse sanity check, not a rubric. A correct
  diagnosis that phrases things differently than expected can still fail a
  case, and a wrong diagnosis that happens to mention the right word can
  still pass.
- Gemini output is non-deterministic. An occasional failure on a rerun does
  not necessarily indicate a regression; a repeated failure across several
  runs is a stronger signal.
- These calls spend real API quota and are subject to Gemini's free-tier
  rate limits, so they are run manually and deliberately, not on every
  change.
