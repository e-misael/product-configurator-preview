# 05 — Backlog

An increment is marked **Done** only with implementation **and** validation evidence (commands run and their results).

Status values: Planned, In progress, Done.

## M0 — Foundation

Status: **In progress** — implemented; pending owner review and commit.

- [x] Vite + React 19 + TypeScript strict project
- [x] ESLint (incl. jsx-a11y), Prettier
- [x] Vitest + React Testing Library
- [x] Playwright (desktop Chromium, mobile Chromium, mobile WebKit smoke)
- [x] Minimal app shell (pt-BR)
- [x] Domain types and validation, with tests
- [x] Empty, frozen catalog
- [x] Documentation (`docs/01`–`06`), `CLAUDE.md`, `README.md`
- [x] Claude Code skills and QA agent
- [x] GitHub Actions CI (no Playwright)

## M1 — Component catalog

Status: Planned. **Blocked on real product information from the store.**

- Real plate, frame, and color definitions (names, supported shapes/colors, compatibility).
- Asset files under `public/catalog/placas` and `public/catalog/quadros`.
- Catalog integrity validation (unique IDs, no dangling references, color categories consistent with `supportedColorCategories`).
- Selectors for available components (e.g. frames compatible with a plate + shape).
- Missing-asset handling.

## M2 — Configuration interface

Status: Planned.

- `useConfiguration` hook (React state).
- Plate, frame (incl. "Sem quadro"), color category, shape, and text controls.
- Accessible, touch-friendly, mobile-first form.
- Display of incomplete/invalid states without auto-replacing selections.

## M3 — Live preview

Status: Planned.

- Composition model shared by preview and export.
- SVG renderer (pending D-007 approval).
- Responsive sizing; text wrapping, alignment, overflow handling.
- Preview rendering regression tests.

## M4 — Image export

Status: Planned.

- Confirm format, resolution, transparency, background, file naming.
- Export from the shared composition.
- Preview/export consistency tests.

## M5 — Quality and usability

Status: Planned.

- Broader mobile/browser testing.
- Accessibility audit.
- Regression coverage and visual refinement.

## Future — Store integration

Status: Not scheduled.

- Nuvemshop integration, pricing, order workflows.
