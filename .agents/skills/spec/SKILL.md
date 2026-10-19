---
name: spec
description: Align on a new BakeFix feature before building it and write docs/specs/<feature>.md. Manual invocation only.
disable-model-invocation: true
---

# Spec

1. Explore the related code and relevant `context/` docs read-only. Do not edit code.
2. Interview the user one question at a time. Give your recommended answer with each question.
3. Cover:
   - Frontend: behaviour, UI states (loading / empty / error), accessibility.
   - Backend: API contract (request/response shapes, status and error codes), server vs client split, Zod validation at the API boundary, timeouts and rate limits, Gemini cost/quota.
   - Edge cases, secrets, and which zone (AGENTS.md) each touched file is in.
4. Write `docs/specs/<feature>.md` with these sections:
   - Goal
   - Scope
   - Out of scope
   - Files & interfaces
   - Tasks: vertical slices, numbered, each with "blocked by" and acceptance criteria
   - Testing (yellow-zone files need characterization tests first)
   - End-to-end check
5. Show the spec and stop. Do not start implementing.
