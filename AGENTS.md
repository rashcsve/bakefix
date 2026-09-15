# BakeFix agent instructions

Before changing code:

1. Read context/product.md.
2. Read context/architecture.md.
3. Read context/progress.md.
4. Read the relevant section in context/build-plan.md.
5. Read context/ui-tokens.md for UI changes.
6. Read context/ai-contract.md for AI changes.

## Workflow

- Work on one build-plan step at a time.
- Before implementation, explain the approach and affected files.
- Stay within the current step.
- Run the relevant checks after implementation.
- Update context/progress.md after completing a step.
- Update context/ui-registry.md after establishing a reusable UI pattern.
- Do not commit unless explicitly requested.

## Definition of done

A step is complete only when:

- Its acceptance criteria pass.
- Lint and type checking pass.
- Relevant tests pass.
- UI changes were inspected at mobile and desktop sizes.
- progress.md reflects the current state.

## Git safety

- Never commit .env.local or secrets.
- Inspect staged changes before proposing a commit.
- Do not modify unrelated files.
