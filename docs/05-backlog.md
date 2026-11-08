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

Status: **Done** — commit `e2a8471`. Corrective increment for the M0 QA findings. Evidence: typecheck, lint, format check, 47 unit tests, build, and 6/6 Playwright smoke tests passed.

- [x] M-1: `incompatible-plate` evaluated whenever the plate is known, independent of shape (D-016)
- [x] L-1: docs and skills describe the per-field contract: at most one issue per field, fixed precedence (D-016)
- [x] L-4: blank text rule covers whitespace and U+200B/200C/200D/2060/FEFF; code renamed `whitespace-only` → `blank` (D-017)
- [x] L-5: `tsconfig.node.json` strictness aligned with app; ESLint recommended rules applied to `*.js` config files
- [x] L-6: QA reviewer read-only rules made explicit (instruction-level, not enforced); build added to its checks

## M1 — Component catalog

Status: In progress. M1.1, M1.1.1, and M1.2 need no real data; M1.3 is **blocked on real product information from the store.**

### M1.1 — Catalog integrity (first sub-increment, before real products)

Status: **Done** — commit `a4dbb75`. Evidence: typecheck, lint, format check, 103 unit tests, build, and 6/6 Playwright smoke tests passed; independent QA review verdict: ACCEPT WITH MINOR ISSUES (findings addressed in M1.1.1).

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

### M1.1.1 — Catalog integrity corrections

Status: **Done** — commit `b369edb` (committed with the message intended for M1.2; content is M1.1.1). Corrective increment for the M1.1 QA findings. Evidence: typecheck, lint, format check, 126 unit tests, build, and 6/6 Playwright smoke tests passed.

- [x] L-1: `unreachable-compatibility` for a frame restricted to a plate sharing no shape, per referenced plate (D-022)
- [x] L-2: reference checks resolve duplicate IDs to the first occurrence
- [x] L-3: non-string IDs rejected without coercion (D-019)
- [x] L-4: ESLint `no-restricted-imports` enforces the `getCatalog()` entry point (D-020)
- [x] L-5: recursive freeze assertion on the production catalog and on the real entry point with nested synthetic data
- [x] L-6: regression tests for triplicate IDs, malformed-first duplicates, cross-collection references, multiple inconsistencies, partial unreachable compatibility

### M1.2 — Plate models with fixed shape and frame capability

Status: **In progress** — implemented; pending owner review.

- [x] `PlateShape` extended with `circle` (D-025)
- [x] Each plate model has one fixed `shape`; `dimensions` and `asset` are no longer keyed by shape (D-023)
- [x] `Configuration.shape` removed; shape derived via `getPlateShape` (D-023)
- [x] Required `Plate.supportsFrame`; circle plates never support frames (D-024)
- [x] Configuration validation: `frame-not-supported`; frame rules evaluated against the plate's shape (D-016)
- [x] Catalog integrity: `frame-capability-conflict`, `unsupported-frame-shape`; `unreachable-compatibility` covers frameless plates (D-022, D-024)
- [x] Pure `selectPlate` (explicitly clears an unsupported frame, reports `cleared`) and `getFrameOptions` (D-026)

### M1.3a — Asset-ready catalog foundation

Status: **Done** — implemented; pending owner review. No real products or images.

- [x] Asset path convention `/catalog/{plates|frames|colors}/{owner-id}/{name}.{webp|png|jpg}`, runtime allowlist validation (D-031)
- [x] Optional `AssetRef.widthPx`/`heightPx`, both or neither, positive integers
- [x] `Plate.images` per color variation, exact-match `findPlateImage` with no fallback (D-032)
- [x] `Frame.images` per compatible plate model with `back`/`front` layers, `findFrameImage`; compatibility via `isFrameCompatible` (D-033)
- [x] Optional normalized placement metadata and its integrity checks (D-034)
- [x] Asset gate test: referenced files must exist under `public/` (passes trivially while the catalog is empty)
- [x] Asset preparation guide: [07-product-assets.md](07-product-assets.md)

### M1.3b — Real asset registration

Status: Planned. **Blocked on clean photographs and measurements from the store.**

- Real plate, frame, and color definitions (names, shapes, frame support, colors, compatibility).
- Processed images under `public/catalog/` (background removal/masking, perspective correction as needed); originals archived outside the repository with provenance.
- Declared intrinsic sizes plus a check that they match the files.
- Calibrated `objectBounds`, text areas, and frame placement; visual verification against the originals.
- Checklist: [07-product-assets.md](07-product-assets.md#m13b-checklist).

## M2 — Configuration interface

Status: Done (validated against the demo catalog; production catalog still empty).

- [x] `useConfiguration` hook (React state) over the pure domain functions.
- [x] Plate, frame (incl. "Sem quadro"), color category, optional shade, and text controls; plate shape displayed, not selected.
- [x] Frame options from `getFrameOptions`; frameless plates show a disabled "Sem quadro" with an explanation; a frame cleared by `selectPlate` is announced (`role="status"`).
- [x] M-1: a frame that becomes incompatible stays visible, marked invalid, with "Remover quadro" or replacement by a compatible frame (D-030).
- [x] Accessible, touch-friendly, mobile-first form (native radios/fieldsets, ≥44px targets, keyboard operable).
- [x] Invalid messages next to their field; missing fields in the status summary (D-029). No selection is auto-replaced except D-026.
- [x] Preview slot with a neutral, labeled placeholder and a text summary — no vector shapes presented as the product (D-027). The composition function is deferred to M3, where it has real inputs.
- [x] Demo mode (`--mode demo`) with a labeled synthetic catalog, excluded from the production build and verified by `check:demo-isolation` (D-028).
- [x] Unit/RTL tests; Playwright: production smoke (empty catalog) and demo functional flows.

## M3 — Live preview

Status: Planned.

- Composition model shared by preview and export, layering real plate image, frame image, and text from catalog metadata (D-027, FR-08).
- Renderer choice confirmed (D-007: SVG `<image>` layers vs Canvas 2D).
- Synthetic demonstration images (non-production) for rendering tests; real images once M1.3 provides them.
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
