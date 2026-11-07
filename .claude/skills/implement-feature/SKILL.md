---
name: implement-feature
description: Plan and implement a Taavi Configurator feature or backlog increment (M1–M5) end to end — read docs, propose a focused plan, wait for approval, implement with tests, run checks, and report. Use whenever asked to build, add, or change functionality.
---

# Implement a feature

Follow these steps in order. Do not skip the approval gate.

## 1. Read

- `CLAUDE.md`, then the docs relevant to the request:
  - `docs/02-requirements.md` — find the FR-xx IDs and acceptance criteria involved.
  - `docs/05-backlog.md` — confirm which increment this belongs to.
  - `docs/06-decisions.md` — note approved vs proposed decisions that apply.
  - `docs/04-data-model.md` if domain types or validation are touched.

## 2. Inspect

- Read the existing code you will touch (`src/domain`, `src/catalog`, components, hooks).
- Run `git status` to know the starting state.

## 3. Identify impact

- Which domain rules apply? (Use the `product-domain` skill for anything touching types, catalog, or validation.)
- Which UI/preview concerns apply? (Use the `visual-ux` skill for UI, layout, preview, or export.)
- Does the request depend on information that doesn't exist yet (dimensions, colors, assets, typography, export specs)? If so, **stop and ask** — never invent it.
- Does it rely on a **Proposed** decision? Ask for confirmation before treating it as approved.

## 4. Propose a plan

Present a concise plan containing:

- Goal and FR IDs covered.
- Files to create/modify.
- Domain/type changes.
- Tests to add.
- Out of scope for this change.
- Assumptions and questions needing confirmation.

## 5. Wait for explicit approval

Do not edit files until the user approves. Apply any adjustments they request.

## 6. Implement only the approved scope

- No unrelated refactoring, renames, or dependency upgrades.
- Create new directories only when this change needs them.
- Keep domain code pure; keep product rules out of rendering code.
- UI text in pt-BR; code and comments in English.

## 7. Tests

- Domain: unit tests for valid, incomplete, and invalid cases of every new rule.
- UI: React Testing Library tests by role/label.
- User flows/responsive: Playwright specs; tag basic ones `@smoke` so they also run on mobile WebKit.
- Test fixtures use `test-` prefixed IDs and live under `tests/`.

## 8. Validate

Run the `quality-check` skill. Fix failures caused by your change.

## 9. Update docs

- Requirement status in `docs/02-requirements.md`.
- Checklist in `docs/05-backlog.md` (mark Done only with validation evidence).
- New or changed decisions in `docs/06-decisions.md`.
- `docs/04-data-model.md` if types changed.

## 10. Report

- Files created/modified.
- Check results (passed / failed / skipped with reason).
- Deviations from the approved plan.
- Risks and open decisions.
- Suggested Conventional Commit message.

**Never commit automatically.** Optionally suggest running the `qa-reviewer` agent.
