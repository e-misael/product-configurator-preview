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

- **Decision:** Code, technical docs, agent and skill instructions in English. User-facing UI in Brazilian Portuguese (pt-BR), preserving the product terms "Placa" and "Quadro"; the generic words are "Modelo" (a product) and "Moldura" (the optional frame) (D-040).
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-012 — Shape and color as plate-constrained selections

- **Decision:** Shape and color are user selections, constrained by the selected plate's `supportedShapes`, `supportedColorCategories`, and `supportedColorIds`. Configuration stores `colorCategory` and an optional `colorId`; when `colorId` is present it must exist, belong to the category, and be supported by the plate. The model must stay extensible for variant-level availability.
- **Status:** Superseded — shape by D-023, color by D-041 (color is no longer a user selection).
- **Date:** 2026-11-07.

### D-013 — Text validation

- **Decision:** Empty text → incomplete; whitespace-only → invalid; text stored exactly as entered.
- **Status:** Approved. Amended by D-017 (blank rule extended to invisible characters; code renamed `whitespace-only` → `blank`).
- **Date:** 2026-11-07.

### D-014 — Declared frame compatibility

- **Decision:** Every frame declares compatible shapes and may restrict plate IDs. There is no implicit "fits all".
- **Caveat:** Matching shapes is not proof of physical compatibility. Actual dimensions and mounting constraints are required before production use.
- **Status:** Approved. Amended by D-024: a frame also requires the plate to declare `supportsFrame: true`.
- **Date:** 2026-11-07.

### D-015 — Browser test coverage

- **Decision:** Playwright projects: desktop Chromium, mobile Chromium (Pixel 7), mobile WebKit (iPhone 14) limited to `@smoke` tests.
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-016 — At most one validation issue per field

- **Context:** M0 review (L-1) found the docs claimed "all issues are reported" while the code reports only the first failing rule per field.
- **Decision:** Every field is evaluated and reports at most one issue, chosen by a fixed, documented precedence (docs/04-data-model.md). For frames, `incompatible-shape` precedes `incompatible-plate`; `incompatible-plate` is evaluated whenever the plate is known, independently of shape selection. Since M1.2 (D-023, D-024) the frame order is: `unknown-reference` → `unavailable` → `frame-not-supported` → `incompatible-shape` (plate's shape) → `incompatible-plate`, with the last three requiring a known plate.
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
- **Decision:** A pure `validateCatalog(catalog)` returns `valid` or `invalid` with **all** issues, each with an explicit code (`invalid-id`, `duplicate-id`, `duplicate-entry`, `unknown-reference`, `unreachable-compatibility` (D-022), `empty-list`, `unsupported-shape-key` (removed by D-033), `color-category-mismatch`, `invalid-dimension`, `invalid-asset`; extended by D-031–D-034), a path, the owning component ID, and an optional related path. Deterministic order. It never repairs or filters data. A present-but-empty `compatibility.plateIds` is an error (it would fit no plate); omitting it means "no restriction".
- **Rationale:** Catalog validation is a diagnostic tool for maintainers, so complete reporting beats one-issue-per-field (contrast D-016).
- **Alternatives:** Runtime schema library (e.g. Zod) — unnecessary dependency for typed local data; fail-fast on first error.
- **Update (M4.1a):** `color-category-mismatch` and `unsupported-variation` were removed with the color model (D-041); `empty-label` was added.
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-019 — Catalog ID format and uniqueness

- **Decision:** IDs match `^[a-z0-9]+(?:-[a-z0-9]+)*$` (lowercase kebab-case, e.g. `placa-quadrada-01`) and are unique across colors, plates, and frames. Non-string IDs are rejected with an explicit type check, never coerced by the regular expression (M1.1.1). Reference checks resolve duplicated IDs to their first occurrence.
- **Rationale:** Stable, URL- and filename-safe, unambiguous in logs, exports, and future store links.
- **Alternatives:** Only reject empty/whitespace IDs; uniqueness per collection only.
- **Update (M4.1a):** There is no `colors` collection any more (D-041); IDs are unique across plates and frames. `placa-quadrada-01` is only a format example.
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
- **Decision:** For each entry in a frame's `compatibility.plateIds` that resolves to a plate, report `unreachable-compatibility` (path `frames[i].compatibility.plateIds[j]`, `relatedPath` = the plate) when the frame's `compatibility.shapes` and the plate's `supportedShapes` share no shape. Entries are evaluated independently; skipped when either shape list is empty (already `empty-list`). Since M1.2: reported when the plate has `supportsFrame: false` or its single `shape` is not among the frame's shapes; the shape comparison is skipped only when the frame's shape list is empty. Unrestricted frames are not checked against existing plates.
- **Rationale:** Same reasoning as rejecting an empty `plateIds`: a declared restriction that can never apply is a definition error. No dimensions are required; a shared shape remains a necessary, not sufficient, condition (D-014).
- **Alternatives:** Report once per frame; also flag unrestricted frames matching no existing plate (depends on catalog contents, deferred).
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-023 — Plate models with one fixed shape; shape not stored in the configuration

- **Context:** Product decision: square, rectangular, and circular plates are separate physical models with independent catalog IDs.
- **Decision:** `Plate.shape` is a single fixed `PlateShape`; `dimensions` and `asset` describe that one shape. `Configuration` has no `shape` field; the shape is derived from the selected plate (`getPlateShape`). Removes the `shape` missing/unsupported rules and `supportedShapes`. Partially supersedes D-012.
- **Rationale:** Storing a value that is fully determined by the plate would allow inconsistent configurations. No configurations are persisted yet, so there is no migration.
- **Alternatives:** Keep `shape` as a stored, validated copy (redundant; reintroduces inconsistency).
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-024 — Explicit `supportsFrame` capability

- **Decision:** Every plate declares a required `supportsFrame` boolean. Circular plates never support frames; square and rectangular plates may, subject to frame compatibility. Application code checks `supportsFrame`, never the shape. The circle rule is enforced once, by catalog integrity via `FRAMELESS_SHAPES`: `frame-capability-conflict` (circle plate with `supportsFrame: true`) and `unsupported-frame-shape` (`circle` in a frame's shapes). Configuration validation reports `frame-not-supported` for a frame on a frameless plate.
- **Rationale:** One explicit capability instead of scattered shape checks; keeps future frameless square/rectangle models possible.
- **Alternatives:** Derive frame support from `shape === 'circle'` at each use site.
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-025 — `circle` plate shape

- **Decision:** `PlateShape` is `square | rectangle | circle`. No dimensions, aspect ratios, or equal-side constraints are assumed; dimension consistency checks wait for real measurements.
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-026 — Explicit frame clearing on plate selection

- **Context:** Product decision: switching to a plate that does not support frames must clear a previously selected frame.
- **Decision:** Pure `selectPlate(config, plateId, catalog)` sets the plate and, only when the new plate has `supportsFrame: false`, clears `frameId` and returns `cleared: ['frameId']` so the UI must announce it. An incompatible frame on a plate that supports frames, or an unknown plate, is not cleared; validation reports it. `getFrameOptions` lists frames offerable for a plate. This is the explicit, visible exception to "never auto-replace a selection" (D-005).
- **Alternatives:** Also clear any frame that becomes incompatible (not approved); implement only in the UI (untestable without components).
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-027 — Real product imagery

- **Context:** Approved product requirement: the final configurator must show actual product images for plates and frames.
- **Decision:** The preview and exported image are composed in layers from real product image assets supplied by the store: plate model (and color/finish variation), optional frame, and personalized text, with scaling, alignment, and positioning defined by catalog data. Color and finish are represented by images of the real variation; a CSS tint/filter/blend over a photograph is not an accurate representation of a ceramic color. Generic vector representations are temporary demonstration output only. Synthetic demonstration assets may be used for workflow tests but stay out of the production catalog and are labeled as such. Product imagery stays independent of `Configuration` and domain validation. No production photographs are generated or invented. M2 prepares the interface (preview slot, labeled placeholder); M3 implements the renderer; M1.3 adds real assets and the required catalog metadata.
- **Rationale:** Visual accuracy is a functional requirement; customers must see the physical product they are ordering.
- **Alternatives:** Vector-only rendering; tinting a single photograph per plate (rejected: misrepresents ceramic color).
- **Impact:** D-007 (SVG) was superseded by D-035 (Canvas 2D) in M3.1; D-009 (shared composition) is implemented for the preview and confirmed for export in M4. Adds pending items P-06–P-08.
- **Update (M4.1a):** Each model has one fixed color, so "color/finish variation" now means the model's own photograph (D-041); the no-tint rule is unchanged.
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-028 — Demo mode with an isolated synthetic catalog

- **Context:** Production product photographs do not exist yet (M1.3b), so the preview cannot be exercised or tested end to end with real imagery.
- **Decision:** A Vite `demo` mode (`npm run dev:demo`, `npm run build:demo` → `dist-demo/`) loads `src/demo/demo-catalog.ts` and a "Modo demonstração" banner through a dynamic import guarded by `import.meta.env.MODE`. Demo entries use `demo-` IDs, names labeled "(demonstração)", and pending dimensions; they mirror the four production models, with `demo-quadro` made frame-capable only to exercise the frame flow. The production build must contain no demo data: `scripts/check-demo-isolation.js` scans every file in `dist/` (all chunks and assets) for demo markers, runs in CI after the build, and is checked against `dist-demo/` with `--expect-present` to prove it detects them. Playwright runs functional flows against the demo build and a smoke test against the production build.
- **Alternatives:** Test fixtures only (no manual demo); demo entries in the production catalog behind a flag (rejected: risk of shipping fake products).
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-029 — Validation message placement

- **Decision:** Invalid issues are explained next to their field (linked with `aria-describedby`). Missing required fields are listed only in the status summary ("Falta escolher: …"), so an untouched form is not covered in errors. The summary reports "Configuração completa." or that incompatible choices exist.
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-030 — Kept-but-invalid selections stay visible

- **Context:** M-1: after a plate change, a frame incompatible with the new plate (on a plate that supports frames) is kept by `selectPlate` (D-026) but is no longer among `getFrameOptions`.
- **Decision:** Any selection that is invalid and not among the offered options (frame, shade, color category, unavailable plate) is shown with its name, an "incompatível/indisponível" title, and its validation message. Frames and shades offer a remove action; any listed option replaces it. "Sem quadro" is checked only when `frameId` is `null`, and the preview never shows "Sem quadro" while a frame is selected. Unavailable plates are not offered.
- **Alternatives:** Silently clear the frame (rejected: auto-correction beyond D-026); show "Sem quadro" (rejected: misrepresents the configuration).
- **Update (M4.1a):** Shades and color categories no longer exist (D-041); the frame wording is now "Sem moldura" and the model is "Modelo" (D-040).
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-031 — Same-origin asset paths in owner folders

- **Context:** Catalog-defined image paths must be safe and predictable before real files are registered (M1.3a).
- **Decision:** `AssetRef.src` must match `/catalog/{plates|frames|colors}/{owner-id}/{name}.{webp|png|jpg}` with kebab-case segments, where `owner-id` is the ID of the component that references it. The check is an allowlist at runtime (`isValidAssetPath`, `invalid-asset`), so external URLs, other schemes (`data:`, `javascript:`), traversal, query strings, and encoded characters are rejected; TypeScript types are not relied on. Assets are same-origin files under `public/catalog/` so a future canvas export is not tainted. File existence is verified by a test that lists `public/catalog/` at test time; there is no runtime fetch. Optional `widthPx`/`heightPx` are declared together as positive integers; M1.3b adds a check that they match the files. Originals stay outside the repository in Taavi's source archive (P-10). Guide: `docs/07-product-assets.md`.
- **Alternatives:** Free-form paths checked only for non-blank (previous rule; too permissive); external hosting (out of scope).
- **Update (M4.1a):** The `colors` owner folder no longer exists; paths are `/catalog/{plates|frames}/{owner-id}/…` (D-041).
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-032 — Plate photographs per variation, matched exactly

- **Context:** A real color/finish variation must be shown with its own photograph (FR-08.3).
- **Decision:** `Plate.images` replaces `Plate.asset`: one `PlateImage` per `(colorCategory, colorId?)`. An entry without `colorId` is the photograph for the category with no shade chosen. Integrity: the category must be supported by the plate (`unsupported-variation`), the shade must exist (`unknown-reference`), belong to the category (`color-category-mismatch`), and be in `supportedColorIds` (`unsupported-variation`), and each combination appears once (`duplicate-variation`). `findPlateImage` returns `available` only for an exact match; it is `pending` when no category is selected (no default photograph) and when a shade has no photograph of its own (no fallback to another shade or to the category photograph).
- **Alternatives:** A default photograph per plate; category photograph as an approximate fallback (both rejected by the owner).
- **Status:** Superseded by D-041 (one photograph per model; no color variations). The exact-match, no-fallback principle remains in force.
- **Date:** 2026-11-07.

### D-033 — Frame imagery per plate model, with back and front layers

- **Context:** One frame photograph cannot be assumed to fit every compatible plate geometry, and a frame may need a layer above the plate (rim, opening).
- **Decision:** `Frame.images` replaces the per-shape `Frame.assets`: one `FrameImage` per `plateId` with a required `back` layer (behind the plate), an optional `front` overlay (above plate and text), and optional `platePlacement`. Entries are allowed only where `isFrameCompatible(frame, plate)` holds — the same function configuration validation uses — otherwise `unreachable-compatibility`; unknown plates are `unknown-reference`; one entry per plate (`duplicate-variation`). Removes the obsolete `unsupported-shape-key` code. Frame finish variations are pending (P-09).
- **Alternatives:** Images keyed by shape (previous model; no per-plate calibration); a generic layer list (unneeded before real assets).
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-034 — Optional normalized placement metadata

- **Context:** The renderer needs plate, frame, and text placement, but no values can be measured until real photographs exist.
- **Decision:** Placement uses `NormalizedBox` (`x`, `y`, `width`, `height` as 0–1 fractions of the image it belongs to, origin top-left): `PlateImage.objectBounds`, `PlateImage.text.area` (with optional `align`), and `FrameImage.platePlacement`. All are optional until calibrated; none are invented. Integrity (`invalid-placement`): finite values, non-negative origin, positive size, inside the image, a known alignment, and the text area inside `objectBounds` when both are present. A box is positioning metadata only: it does not describe the outline of a circular or irregular object or a frame opening; precise clipping/masking is an M3 decision. Typography and material effects (stamped or raised lettering) are not modeled (P-04).
- **Alternatives:** Pixel coordinates (tied to one file resolution); physical millimeters (dimensions pending).
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-035 — Canvas 2D as the single renderer

- **Context:** The preview must compose same-origin photographs and text, scale responsively, and later be exported as PNG from the same composition (D-009). Supersedes D-007 (SVG).
- **Decision:** One renderer: Canvas 2D (`drawScene`, `src/preview/draw.ts`). Preview and, in M4, export call the same function on different canvases, so they share one code path and the same pixels; export becomes "draw, then `toBlob`". SVG was rejected because exporting it needs a second pipeline (serialize, embed every image as a data URL, rasterize) whose output can differ from the live view. Text wrapping and fitting are done by our own code in both options. The backing store follows the displayed width times the device pixel ratio (clamped to 1–3) and never exceeds the base image's own width, since extra pixels would only upscale the photograph. The canvas is exposed as `role="img"` with an accessible name from the images' `alt`, described by the text summary of the selection. jsdom cannot paint, so unit tests cover composition, layout, and a recording fake context; Playwright reads real canvas pixels.
- **Alternatives:** SVG `<image>` layers (rejected, above); HTML/CSS layering (rejected: no path to export, and layering CSS invites tinting).
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-036 — Synthetic demonstration images served only in demo mode

- **Context:** The preview needs images to be developed and tested while no real photographs exist, without ever shipping fake products.
- **Decision:** `scripts/generate-demo-assets.js` (`npm run generate:demo-assets`) writes deterministic synthetic PNGs to `src/demo/public/catalog/…`; the output is committed. They are deliberately not photograph-like: flat fills, hatched borders, an outlined text area, a "DEMO" stamp, and an embedded PNG comment "Synthetic demonstration image - not a Taavi product photograph". They cover two square models and two scalloped trays (one image each), and two frames with back and front layers; the production catalog has no images, which exercises the pending state. Vite copies its public directory into every build, so `vite.config.ts` sets `publicDir` to `src/demo/public` only in demo mode and to the (currently absent) `public/` otherwise; demo files are never in the production public directory. Isolation is checked three ways: `scripts/check-demo-isolation.js` scans file contents and file names of `dist/` for demo markers (including the PNG comment); a unit test asserts `public/` has no `demo-` files; Playwright asserts the production build requests and serves no demo image. Tests verify the demo catalog's declared pixel sizes match the PNG headers, that no file is orphaned, and that every described image is labeled as a demonstration.
- **Alternatives:** Demo files in `public/` with a build-time exclusion step (rejected: easy to get wrong); generating images at build time (rejected: less reviewable, less deterministic).
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-037 — Composition, scene, and missing-image rules

- **Context:** The preview must never show a configuration or product that differs from the selection, and must say why something is not shown.
- **Decision:** `composePreview(catalog, config, validation)` (pure) selects imagery by exact match (D-032, D-033) and returns the plate, frame, and text layers plus notice codes; it contains no product rules or coordinates. `buildScene` (pure) positions layers from the images' natural sizes and the catalog's normalized boxes, in painting order **frame back → plate → text → frame front**. Rules: (1) nothing is drawn for a plate that is not selected, unknown, or unavailable; (2) a color or shade that conflicts with the plate shows no photograph, never another variation; (3) a frame that fails configuration validation is not drawn; (4) a valid frame without registered imagery for the plate, without `platePlacement`, whose file fails to load, or whose layers differ in aspect ratio by more than 1% is not drawn, and the plate is shown alone; (5) a frame is only drawn together with its plate; (6) text is drawn only inside the plate photograph's calibrated `text.area` — without one it is not drawn and a message says so, while the entered text remains in the configuration and the summary; (7) nothing is drawn until every needed file has settled, so no partial composition flashes; (8) when a frame is used, the plate's `objectBounds` (the whole photograph when pending) are scaled uniformly to fit and centered in `platePlacement`, preserving the aspect ratio, and the front layer covers the frame image. Each state — not selected, color missing or invalid, image pending in the catalog, loading, file failed to load, frame problems, text area pending, text overflow — has its own pt-BR message beside the canvas (`aria-live="polite"`), distinct from the others. A catalog-pending image and a failed load are different states.
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-038 — Provisional text fitting

- **Context:** Typography and text limits are pending (P-04); the preview still needs readable, honest text.
- **Decision:** Explicit line breaks (`\n`, `\r\n`, `\r`) are kept, including empty lines. Lines wrap at spaces; a word wider than the area is split between grapheme clusters (emoji sequences and accents stay intact). The font starts at 25% of the text area's height and shrinks by a factor of 0.9 per step down to a minimum of 8% of the area's height; line height is 1.2. If the text still does not fit at the minimum, it is drawn at the minimum size, unclipped, and a visible warning is shown; text is never truncated or clipped. Font (`system-ui`) and color (`#2b2b2b`) are provisional, alignment comes from the catalog (default center), and no stamped or raised effect is simulated. The constants live in `src/preview/text-fit.ts` and `src/preview/draw.ts`.
- **Alternatives:** Clipping to the area (rejected: silently hides text); a fixed font size (rejected: ignores the area).
- **Status:** Approved (provisional until P-04).
- **Date:** 2026-11-07.

### D-039 — M4.1 in two slices; text styling is part of M4 acceptance

- **Context:** M4.1 combined a product-model refinement with advanced text customization.
- **Decision:** M4.1a (models and fixed properties; D-040, D-041) and M4.1b (advanced text; D-042) are separate, independently testable slices; M4.1b is not started with M4.1a. Because M4 (PNG export) is not implemented, the preview and the export must both render the M4.1b styling (font family, colors, position) from the same scene; this is a required M4 acceptance criterion.
- **Status:** Approved.
- **Date:** 2026-11-08.

### D-040 — Four product models; "Modelo" and "Moldura"; `scalloped`

- **Context:** Taavi supplied the products currently sold: Placa cerâmica (10 cm x 10 cm), Quadro (20 cm x 20 cm), and two Bandeja ondulada M (~ 8 cm and ~ 11 cm). The earlier "Placa" and "Quadro" wording no longer fits: Quadro is now a product.
- **Decision:** The customer chooses a **Modelo** (code type `Plate`); the optional frame is **Moldura** (`Frame`). The four models are registered in the production catalog with the supplied names and size labels, which are shown as `displayName (sizeLabel)` and kept as supplied, approximations included. The Quadro (20 cm x 20 cm) is a separate model, not a frame. `PlateShape` gains `scalloped` for the two wavy trays as a classification only: no geometry is inferred and no frame rule depends on it. Physical dimensions stay `pending` (`sizeLabel` is display text). Every model is `supportsFrame: false` because no model is confirmed to take an optional frame; the production catalog has no frames. Provisional IDs (`placa-ceramica-10`, `quadro-20`, `bandeja-ondulada-m-8`, `bandeja-ondulada-m-11`) become permanent once Taavi confirms them (P-12). The shape is no longer shown in the UI.
- **Alternatives:** Keeping "Placa" as the generic word (ambiguous with the Placa cerâmica model); inferring shapes for the trays (rejected: invented data).
- **Status:** Approved (IDs pending confirmation).
- **Date:** 2026-11-08.

### D-041 — Fixed ceramic color owned by the catalog; one image per model

- **Context:** Taavi's pieces are all beige ("Bege"); the customer does not choose the ceramic color. Supersedes D-012 (color) and D-032.
- **Decision:** Color categories, specific colors, and the color selection are removed. `Plate.ceramicColor` holds the fixed color as supplied ("Bege") and is shown read-only as "Cor da peça". Configuration validation has no color rule. `Plate.image` is the model's single photograph (optional while pending); the former per-variation images, swatches, `colors` collection, and `/catalog/colors/` asset folder are gone. Integrity adds `empty-label` for blank `sizeLabel`/`ceramicColor`. No customer configuration is persisted, so no data migration is needed; a demo session simply restarts. Preview and export keep the real-image rule (D-027): the photograph is never tinted.
- **Status:** Approved.
- **Date:** 2026-11-08.

### D-042 — Advanced text customization design (planned, M4.1b)

- **Context:** The product needs font family, up to two lettering colors, and text positioning.
- **Decision (design only, not implemented):** (1) `fontFamily` is `serif` or `sans-serif` ("Com serifa" / "Sem serifa", default sans-serif), mapped to provisional system font stacks; real typography stays pending (P-04). (2) `textColorId` is required (no default) and `secondaryColorId` is optional with `secondaryRanges` as UTF-16 offsets snapped to grapheme boundaries; the lettering palette is catalog data (P-02). (3) One source of truth for position: nine presets (left/center/right × top/middle/bottom) plus a normalized manual position inside the calibrated text area; dragging keeps the line alignment; "Redefinir posição" restores the catalog default; the position survives model changes constrained to the new safe area. (4) Touch movement requires an explicit "Mover texto" mode so scrolling is not hijacked; keyboard positioning is supported. (5) Editing text keeps secondary ranges when they map unambiguously and removes or invalidates them otherwise; grapheme clusters are never split. (6) The handmade disclaimer is shown near the controls: "Todas as solicitações de personalização estão sujeitas à análise da Taavi. Como nossas peças são produzidas artesanalmente, podem apresentar pequenas variações de formato, cor, acabamento e posicionamento em relação à pré-visualização." (7) A per-line text-length limit is a future rule, recorded in the backlog and not implemented.
- **Status:** Approved. Points 1, 2, 5, 6, 7 implemented in M4.1b-1 (D-043); points 3 and 4 implemented in M4.1b-2 (D-044, which refines the preset rule).
- **Date:** 2026-11-08.

### D-043 — M4.1b split and lettering implementation (M4.1b-1)

- **Context:** M4.1b combined lettering styles with an interactive positioning model; they are separable and independently testable.
- **Decision:** M4.1b-1 implements typography, lettering colors, styled ranges, and the disclaimer; M4.1b-2 implements positioning with a normalized `textLayout` `{ align, x, y } | null`. Lettering colors are catalog data (`Catalog.textColors`, `TextColor.hex` as `#rrggbb`); the production palette stays empty until supplied (P-02), so production cannot reach "Configuração completa" yet. Ranges are half-open UTF-16 offsets on grapheme boundaries, never spanning `\r`/`\n`, normalized (sorted, merged). Edit remap uses a single-splice model: the textarea caret after the edit locates the splice when it is consistent with the texts; otherwise a prefix/suffix diff is used and, when that is ambiguous (repeated characters), ranges touching the uncertain region are removed and a notice is shown. Text typed inside a colored range is not colored (the range splits). Removing the last range keeps the second color; only "Sem segunda cor" clears both. A second color equal to the primary is `same-as-primary` and its option is disabled. The preview paints text with no usable chosen color in a neutral fallback (`#2b2b2b`); it is a renderer constant, never stored and not a product color, and the preview states it is provisional (notice `text-color-provisional`; summary "Não escolhida"). A valid primary color remains required for completion and for any future export. Lines keep their source offsets through wrapping so colors follow the characters; mixed-color lines are drawn as consecutive runs measured with the same font.
- **Alternatives:** Rich-text editor (rejected, D-042); coloring text typed inside a range (rejected: surprising and ambiguous); a production default color (rejected: invented data).
- **Status:** Approved; implemented and accepted (2026-11-08).
- **Date:** 2026-11-08.

### D-044 — Text alignment and free-space positioning (M4.1b-2)

- **Context:** The customer needs to align the lines and place the text block inside the calibrated text area, consistently across models, screen sizes, and the future export.
- **Decision:** `Configuration.textLayout` is `TextPlacement | null` with `{ align, x, y }`. `align` aligns lines inside the block (block width = widest line); `x`/`y` are fractions (0–1) of the free space around the block inside the calibrated text area, so every valid value keeps the text inside the area and the position carries over to any model's area unchanged. `null` is the catalog default (catalog alignment, `x` = its anchor, `y` = 0.5), which reproduces the earlier rendering exactly; "Redefinir posição" sets `null`. The nine presets set all three properties (column → alignment and `x` ∈ {0, 0.5, 1}; row → `y` ∈ {0, 0.5, 1}); "Alinhamento das linhas" changes only `align`. Text fitting is unchanged: the font size never depends on the position and the text is not enlarged to fill the area, so short text has room to move. On an axis without free space (overflow), the block keeps the established overflow placement (anchored by alignment horizontally, centered vertically) and the warning stays. Dragging (mouse/pen; touch only in "Mover texto" mode, which alone sets `touch-action: none`) converts pointer positions to scene units through the canvas's displayed rectangle, hit tests the block bounds with an 8 CSS-pixel tolerance, and moves each axis by the fraction of its free space travelled; it never changes the alignment. Directional buttons and arrow keys move 2% (10% with Shift). An invalid stored placement is reported (`invalid-layout`), never clamped, and drawn at the default. Export (M4) must be blocked while the scene reports `text-overflow`.
- **Alternatives:** Positions as fractions of the whole area (rejected: the block could leave the area, and positions would not transfer between models); enlarging text to fill the area (rejected: presets would be indistinguishable); presets that keep the current alignment (rejected by the owner: presets set alignment too).
- **Status:** Approved; implemented and accepted (2026-11-08).
- **Date:** 2026-11-08.

## Proposed

### D-007 — SVG preview rendering

- **Status:** Superseded by D-035 (Canvas 2D).

### D-008 — PNG export format

- **Proposal:** Export as PNG, rasterized client-side.
- **Open:** resolution, transparency, background, file naming.
- **Alternatives:** JPEG, SVG download, PDF.
- **Status:** Proposed — confirm in M4.

### D-009 — Shared composition model

- **Proposal:** A pure function derives a composition (layers, geometry, text) from catalog + configuration; both preview and export consume it.
- **Rationale:** Minimizes preview/export inconsistencies.
- **Status:** Proposed — the preview side is implemented (`composePreview`, `buildScene`, `drawScene`, D-035–D-037); confirm the export side in M4.

## Pending

- **P-01:** Real plate dimensions and aspect ratios per shape.
- **P-02:** The production lettering-color palette (names and `#rrggbb` values) for `Catalog.textColors`; until supplied, a configuration cannot be completed in production once the text color is required. The ceramic color is resolved by D-041.
- **P-03:** Frame dimensions and mounting constraints.
- **P-04:** Production typography rules and text limits (max length, lines).
- **P-05:** Export resolution, transparency, background, file naming.
- **P-06:** Real product images per model and per frame; each model now has one photograph (D-041).
- **P-07:** Layer placement metadata: text safe area, frame aperture and offset, scale relative to real dimensions.
- **P-08:** Source image format, resolution, and consistency requirements (framing, lighting, background). Conventions and recommendations: `docs/07-product-assets.md`.
- **P-09:** Whether frames have finish variations (e.g. wood tones) that need their own imagery.
- **P-10:** Location and naming of original photographs in Taavi's source archive, for provenance records.
- **P-11:** Resolved by D-040: the scalloped dishes are the Bandeja ondulada M models. No circular model is registered.
- **P-12:** Confirmation of the four permanent model IDs.
- **P-13:** Whether any model takes an optional frame (`supportsFrame`), and if so which frames and imagery.
- **P-14:** Real serif and sans-serif typefaces for the text (system stacks are provisional) and the per-line text-length limit.
