# 05 — Backlog

An increment is marked **Done** only with implementation **and** validation evidence (commands run and their results).

Status values: Planned, In progress, Done.

## M0 — Foundation

Status: **Done** — commit `a61b3c5`. Evidence: typecheck, lint, format check, 31 unit tests, build, and 6/6 Playwright smoke tests (desktop Chromium, mobile Chromium, mobile WebKit) passed; independent QA review verdict: ACCEPT WITH MINOR ISSUES (findings addressed in M0.1).

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

## M0.1 — Foundation corrections

Status: **In progress** — implemented; pending owner review. Corrective increment for the M0 QA findings.

- [x] M-1: `incompatible-plate` evaluated whenever the plate is known, independent of shape (D-016)
- [x] L-1: docs and skills describe the per-field contract: at most one issue per field, fixed precedence (D-016)
- [x] L-4: blank text rule covers whitespace and U+200B/200C/200D/2060/FEFF; code renamed `whitespace-only` → `blank` (D-017)
- [x] L-5: `tsconfig.node.json` strictness aligned with app; ESLint recommended rules applied to `*.js` config files
- [x] L-6: QA reviewer read-only rules made explicit (instruction-level, not enforced); build added to its checks

## M1 — Component catalog

Status: Planned. M1.1 runs first; the rest of M1 is **blocked on real product information from the store.**

### M1.1 — Catalog integrity (first sub-increment, before real products)

Status: **In progress** — implemented; pending owner review.

- [x] Recursive `deepFreeze` (no dependency); immutability tested at root, collection, component, compatibility, dimension, and asset levels (D-020)
- [x] Single catalog entry point `getCatalog()`; raw data in `src/catalog/data.ts` (D-020)
- [x] `validateCatalog` with explicit codes and paths (D-018):
  - [x] valid kebab-case IDs, unique across the whole catalog (D-019);
  - [x] no duplicate entries in any supported/compatibility list;
  - [x] no dangling references (`supportedColorIds` → colors, `compatibility.plateIds` → plates);
  - [x] each supported color's category is listed in the plate's `supportedColorCategories`;
  - [x] no empty `supportedShapes`, `supportedColorCategories`, `compatibility.shapes`, or present-but-empty `compatibility.plateIds`;
  - [x] `dimensions` and `assets` keys are a subset of the supported shapes;
  - [x] defined dimensions finite and positive; asset `src` non-blank.
- [x] Catalog test gate: production catalog must pass `validateCatalog` (D-021)

### M1 — remaining scope

- Real plate, frame, and color definitions (names, supported shapes/colors, compatibility).
- Asset files under `public/catalog/placas` and `public/catalog/quadros`.
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
