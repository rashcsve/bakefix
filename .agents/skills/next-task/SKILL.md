---
name: next-task
description: Implement the next unblocked task from a BakeFix spec in docs/specs/, tests first. Manual invocation only.
disable-model-invocation: true
---

# Next task

1. Read the spec in `docs/specs/` (ask which one if there are several). Pick the next unblocked, unfinished task and name it.
2. Write failing tests first. Run them and show that they fail. Stop and wait for the user to check them.
3. Implement until the tests pass. Pause for a self-check about every 40 changed lines: compare against the task, check types, fit with the architecture.
4. Run `pnpm typecheck`, the relevant tests and `pnpm lint`. Show the commands and output.
5. Mark the task done in the spec. Stop. Do not start the next task and do not commit.
