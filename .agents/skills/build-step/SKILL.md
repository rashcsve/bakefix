---
name: build-step
description: Implement one numbered BakeFix development step from planning through verification. Use when asked to build, implement, continue, or complete a project step.
---

# Build Step

The user must specify a step number.

## Required context

Always read:

1. AGENTS.md
2. context/product.md
3. context/architecture.md
4. context/build-plan.md
5. context/code-standards.md
6. context/progress.md

For UI work, also read:

- context/ui-tokens.md
- context/ui-registry.md

For AI work, also read:

- context/ai-contract.md

## Workflow

1. Find the requested step in context/build-plan.md.
2. Inspect the existing implementation and git status.
3. Identify the files that should change.
4. Present a concise implementation plan before editing.
5. Implement only the requested step.
6. Do not introduce out-of-scope functionality.
7. While implementing, pause for a self-check after roughly every 40 new or changed lines of code (a guideline for when to stop and look, not a requirement to split code unnaturally). At each checkpoint:
   - Compare the change so far against the current step in context/build-plan.md.
   - Check type correctness.
   - Check that the change fits the existing architecture.
   - Look for obvious errors.
   - Fix anything found before continuing implementation.
8. Run the verification commands required by the step.
9. Inspect mobile and desktop layouts when UI changes.
10. Fix failures caused by the current step.
11. Update context/progress.md after successful verification.
12. Update context/ui-registry.md if a reusable UI pattern was created.
13. Report:
    - work completed
    - files changed
    - checks performed
    - remaining issues
    - proposed commit name

## Safety

- Never commit or push unless explicitly requested.
- Never open, modify or reveal .env.local.
- Never add an unapproved dependency.
- Preserve unrelated changes.
- Stop if project context contains conflicting requirements.
