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

- **Decision:** `validateConfiguration` returns `valid`, `incomplete`, or `invalid` (invalid takes precedence) with the list of issues found. It never replaces a user selection. Issue reporting is refined by D-016 (at most one issue per field).
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
- **Status:** Approved. Amended by D-017 (blank rule extended to invisible characters; code renamed `whitespace-only` → `blank`).
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

### D-016 — At most one validation issue per field

- **Context:** M0 review (L-1) found the docs claimed "all issues are reported" while the code reports only the first failing rule per field.
- **Decision:** Every field is evaluated and reports at most one issue, chosen by a fixed, documented precedence (docs/04-data-model.md). For frames, `incompatible-shape` precedes `incompatible-plate`; `incompatible-plate` is evaluated whenever the plate is known, independently of shape selection.
- **Rationale:** One actionable message per field suits the UI; deterministic order makes results testable.
- **Alternatives:** Report every failing rule per field (deferred; not needed by any current consumer).
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-017 — Blank text rule

- **Context:** M0 review (L-4): text made only of zero-width characters passed validation because `String.prototype.trim` does not remove them.
- **Decision:** Non-empty text is invalid (`blank`) when every character is Unicode `White_Space` or one of U+200B, U+200C, U+200D, U+2060, U+FEFF. The check is a pure test; stored text is never trimmed, normalized, or stripped. Empty text remains missing (incomplete).
- **Rationale:** A narrow, explicit list blocks visually empty text without rejecting legitimate Unicode (accents, combining marks, emoji ZWJ sequences, variation selectors).
- **Alternatives:** `trim()` only (misses zero-width characters); reject all Unicode format characters `\p{Cf}` (too broad); Unicode normalization (modifies input).
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-018 — Catalog integrity validation contract

- **Context:** M1.1; catalog definitions must be checked before real products are added (M0 review L-2, L-3).
- **Decision:** A pure `validateCatalog(catalog)` returns `valid` or `invalid` with **all** issues, each with an explicit code (`invalid-id`, `duplicate-id`, `duplicate-entry`, `unknown-reference`, `unreachable-compatibility` (D-022), `empty-list`, `unsupported-shape-key`, `color-category-mismatch`, `invalid-dimension`, `invalid-asset`), a path, the owning component ID, and an optional related path. Deterministic order. It never repairs or filters data. A present-but-empty `compatibility.plateIds` is an error (it would fit no plate); omitting it means "no restriction".
- **Rationale:** Catalog validation is a diagnostic tool for maintainers, so complete reporting beats one-issue-per-field (contrast D-016).
- **Alternatives:** Runtime schema library (e.g. Zod) — unnecessary dependency for typed local data; fail-fast on first error.
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-019 — Catalog ID format and uniqueness

- **Decision:** IDs match `^[a-z0-9]+(?:-[a-z0-9]+)*$` (lowercase kebab-case, e.g. `placa-quadrada-01`) and are unique across colors, plates, and frames. Non-string IDs are rejected with an explicit type check, never coerced by the regular expression (M1.1.1). Reference checks resolve duplicated IDs to their first occurrence.
- **Rationale:** Stable, URL- and filename-safe, unambiguous in logs, exports, and future store links.
- **Alternatives:** Only reject empty/whitespace IDs; uniqueness per collection only.
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-020 — Deep-frozen catalog behind a single entry point

- **Decision:** Raw definitions live in `src/catalog/data.ts`; `src/catalog/index.ts` deep-freezes them once with a local `deepFreeze` helper and exposes `getCatalog()` (synchronous, same instance). Supersedes the M0 shallow freeze. Since M1.1.1, ESLint `no-restricted-imports` blocks importing `catalog/data` outside `src/catalog/**` and `tests/unit/catalog/**`.
- **Rationale:** Runtime immutability at every nesting level, no dependency, no async or network abstraction.
- **Alternatives:** Shallow freeze (insufficient); `readonly` types only (bypassable by casts); an immutability library.
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-021 — Catalog validation runs as a test gate

- **Decision:** `tests/unit/catalog/catalog.test.ts` asserts `validateCatalog(getCatalog())` is `valid`. It runs in `npm test`, `npm run check`, and CI. No runtime validation in `getCatalog()`.
- **Rationale:** Invalid catalogs are blocked before deploy; customers never see a crash caused by catalog data.
- **Alternatives:** Also throw at module load in development mode (revisit if catalog editing moves outside code review).
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-022 — Unreachable frame compatibility

- **Context:** M1.1 review (L-1): a frame restricted to a plate it shares no shape with passed validation but could never be selected.
- **Decision:** For each entry in a frame's `compatibility.plateIds` that resolves to a plate, report `unreachable-compatibility` (path `frames[i].compatibility.plateIds[j]`, `relatedPath` = the plate) when the frame's `compatibility.shapes` and the plate's `supportedShapes` share no shape. Entries are evaluated independently; skipped when either shape list is empty (already `empty-list`). Unrestricted frames are not checked against existing plates.
- **Rationale:** Same reasoning as rejecting an empty `plateIds`: a declared restriction that can never apply is a definition error. No dimensions are required; a shared shape remains a necessary, not sufficient, condition (D-014).
- **Alternatives:** Report once per frame; also flag unrestricted frames matching no existing plate (depends on catalog contents, deferred).
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
