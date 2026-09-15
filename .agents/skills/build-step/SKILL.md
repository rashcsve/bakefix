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
7. Run the verification commands required by the step.
8. Inspect mobile and desktop layouts when UI changes.
9. Fix failures caused by the current step.
10. Update context/progress.md after successful verification.
11. Update context/ui-registry.md if a reusable UI pattern was created.
12. Report:
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
