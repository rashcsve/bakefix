# BakeFix agent instructions

## Context routing

Before every implementation task, read:

- context/product.md
- context/architecture.md
- context/code-standards.md
- context/progress.md
- the current step in context/build-plan.md

For UI work, also read:

- context/ui-tokens.md
- context/ui-registry.md

For AI work, also read:

- context/ai-contract.md

## Workflow

- Work on one build-plan step at a time.
- Use the build-step skill for implementation.
- While implementing, pause for a self-check after roughly every 40 new or changed lines of code. Treat 40 lines as a guideline for when to stop and look, not a requirement to split code unnaturally. At each checkpoint, compare the change so far against the current step in context/build-plan.md, check type correctness, check that the change fits the existing architecture, and look for obvious errors. Fix anything found before continuing.
- Use the review skill before committing.
- Use the recover skill if a problem remains after one normal fix attempt.
- Do not expand the MVP scope.
- Update context/progress.md after completing a step.
- Do not commit or push unless explicitly requested.

## Definition of done

A step is complete only when:

- its acceptance criteria pass
- lint and type checking pass
- relevant tests pass
- UI changes are inspected at mobile and desktop widths
- context/progress.md is updated
