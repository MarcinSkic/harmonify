---
name: plan-execution
description: Skill describing standard workflow when executing plan
---

# Plan Execution Workflow

## 1. Read and understand the plan

- Plans are located in `.claude/.plans/`
- Read the full plan before starting any work
- Identify phases/steps, affected files, and dependencies between phases

## 2. Branch check

Check with `git status` what branch you're on:
- If it matches the plan scope — proceed
- If not — ask the user whether to create a new branch or switch to an existing one
- **Never work on main** unless explicitly told otherwise

## 3. Execution mode

When the plan is split into phases, ask the user before starting:
1. **Pause after each phase** — commit, let user review, then continue
2. **Execute the whole plan** — work through all phases, commit at the end

## 4. During execution

- After writing or modifying code, run `pnpm lint:fix` to auto-fix lint issues — never fix ESLint errors manually
- Run `pnpm type-check` after significant changes to catch type errors early
- If a phase has related tests, run them with `pnpm vitest run <path>` before moving on

## 5. Committing

**Always stop and ask the user before creating a commit.** Never commit automatically. Present a summary of changes and wait for approval. Point 3 defines *how often* to commit (per phase or at the end), but the user always confirms each commit.

## 6. After completing all work

- Run `pnpm lint:fix` on the full project
- Run `pnpm type-check` to verify no type errors remain
- Run `pnpm vitest run` if there are relevant unit tests
- Summarize what was done and any deviations from the plan
