---
name: review
description: Review the current BakeFix implementation against its product requirements, architecture, design system and current build step. Use after implementation or before committing.
---

# Review

## Required context

Read:

- AGENTS.md
- context/product.md
- context/architecture.md
- context/build-plan.md
- context/code-standards.md
- context/progress.md

For UI changes, also read:

- context/ui-tokens.md
- context/ui-registry.md

For AI changes, also read:

- context/ai-contract.md

## Workflow

1. Inspect git status and the current diff.
2. Determine which build step was implemented.
3. Compare the implementation with that step's requirements.
4. Run relevant non-destructive checks.
5. Review:
   - behaviour
   - architecture boundaries
   - TypeScript safety
   - input and output validation
   - secret handling
   - error handling
   - accessibility
   - responsiveness
   - tests
   - unnecessary complexity
   - scope violations

## Output

Report:

1. Critical findings
2. Important findings
3. Minor findings
4. What is implemented well
5. Whether the change is ready to commit

Include concrete file references and evidence.

Do not modify files.
Do not commit or push.
