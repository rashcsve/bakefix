---
name: recover
description: Diagnose and resolve a persistent BakeFix development failure using raw errors and repository evidence. Use after a normal corrective attempt has failed.
---

# Recover

## Required context

Read:

- AGENTS.md
- context/product.md
- context/architecture.md
- context/code-standards.md
- context/progress.md
- the relevant step in context/build-plan.md

Read context/ai-contract.md for AI failures.

## Workflow

1. Read the complete raw error.
2. Reproduce the failure when safe.
3. Inspect relevant code and configuration.
4. Classify the failure as:
   - implementation defect
   - dependency or API mismatch
   - environment/configuration failure
   - incorrect project assumption
   - stale or polluted agent context
5. State the root cause and evidence.
6. Propose the smallest corrective change.
7. Apply only that fix.
8. Run targeted verification.
9. Update context only if an earlier documented decision was wrong.

Do not perform broad refactoring.
Do not hide unresolved failures.
Do not commit or push.
