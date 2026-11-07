# 06 — Decisions

Status values:

- **Approved** — confirmed by the project owner.
- **Proposed** — recommended, not yet confirmed; must be confirmed in the stated increment.
- **Pending** — open question; no decision yet.
- **Superseded** — replaced by a later decision (link it).

## Approved

### D-001 — Technology stack

- **Context:** New project; no existing codebase.
- **Decision:** React 19, TypeScript strict, Vite, ESLint, Prettier, Vitest + jsdom + React Testing Library, Playwright, npm. TypeScript pinned to `~6.0` and ESLint to `9.x` for plugin compatibility (typescript-eslint supports TS `<6.1`; eslint-plugin-jsx-a11y supports ESLint `≤9`).
- **Rationale:** Mainstream, well-supported, fits a static client-side app.
- **Alternatives:** Next.js (unneeded server features); TypeScript 7 / ESLint 10 (incompatible with required lint plugins at time of decision).
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-002 — Local, version-controlled catalog

- **Context:** No backend is in scope; product data changes rarely.
- **Decision:** Catalog is a typed TypeScript module in `src/catalog`, frozen at runtime. Assets in `public/catalog`.
- **Rationale:** Simple, reviewable in Git, type-checked.
- **Alternatives:** JSON files with runtime schema validation; CMS; Nuvemshop API.
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-003 — No global state library

- **Decision:** React state and simple custom hooks. Revisit only if the implementation demonstrates a need.
- **Alternatives:** Zustand, Redux Toolkit, Jotai.
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-004 — No UI component library

- **Decision:** Native elements with project CSS.
- **Rationale:** Minimal, editorial design; few controls; avoids dependency weight and styling conflicts.
- **Alternatives:** Radix, MUI, Chakra.
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-005 — Three-state validation without auto-correction

- **Decision:** `validateConfiguration` returns `valid`, `incomplete`, or `invalid` (invalid takes precedence) and lists all issues. It never replaces a user selection.
- **Rationale:** Prevents the preview from silently showing a different configuration.
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-006 — No invented product data

- **Decision:** Unknown dimensions are `pending`; catalog ships empty until real data is provided; no invented colors, HEX values, typography, or assets. Test fixtures use the `test-` prefix and live only under `tests/`.
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-010 — CI scope

- **Decision:** GitHub Actions runs typecheck, lint, format check, unit tests, and build. Playwright is excluded from CI for now.
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-011 — Language

- **Decision:** Code, technical docs, agent and skill instructions in English. User-facing UI in Brazilian Portuguese (pt-BR), preserving the terms "Placa" and "Quadro".
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-012 — Shape and color as plate-constrained selections

- **Decision:** Shape and color are user selections, constrained by the selected plate's `supportedShapes`, `supportedColorCategories`, and `supportedColorIds`. Configuration stores `colorCategory` and an optional `colorId`; when `colorId` is present it must exist, belong to the category, and be supported by the plate. The model must stay extensible for variant-level availability.
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-013 — Text validation

- **Decision:** Empty text → incomplete; whitespace-only → invalid; text stored exactly as entered.
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-014 — Declared frame compatibility

- **Decision:** Every frame declares compatible shapes and may restrict plate IDs. There is no implicit "fits all".
- **Caveat:** Matching shapes is not proof of physical compatibility. Actual dimensions and mounting constraints are required before production use.
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-015 — Browser test coverage

- **Decision:** Playwright projects: desktop Chromium, mobile Chromium (Pixel 7), mobile WebKit (iPhone 14) limited to `@smoke` tests.
- **Status:** Approved.
- **Date:** 2026-11-07.

## Proposed

### D-007 — SVG preview rendering

- **Context:** Preview must be accurate, responsive, and reusable for export.
- **Proposal:** Render the preview as SVG.
- **Rationale:** Resolution independent, DOM-testable, serializable for export.
- **Alternatives:** HTML/CSS layering; Canvas 2D.
- **Status:** Proposed — confirm in M3.

### D-008 — PNG export format

- **Proposal:** Export as PNG, rasterized client-side.
- **Open:** resolution, transparency, background, file naming.
- **Alternatives:** JPEG, SVG download, PDF.
- **Status:** Proposed — confirm in M4.

### D-009 — Shared composition model

- **Proposal:** A pure function derives a composition (layers, geometry, text) from catalog + configuration; both preview and export consume it.
- **Rationale:** Minimizes preview/export inconsistencies.
- **Status:** Proposed — confirm in M3.

## Pending

- **P-01:** Real plate dimensions and aspect ratios per shape.
- **P-02:** Real colors and their visual representations.
- **P-03:** Frame dimensions and mounting constraints.
- **P-04:** Production typography rules and text limits (max length, lines).
- **P-05:** Export resolution, transparency, background, file naming.
