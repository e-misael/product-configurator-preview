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

- **Decision:** Code, technical docs, agent and skill instructions in English. User-facing UI in Brazilian Portuguese (pt-BR), preserving the product terms "Placa" and "Quadro"; the generic word for a product is "Modelo" (D-040; "Moldura" is no longer used as a choice, D-046).
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
- **Status:** Superseded by D-046 (M4.2): the frame concept was removed; the Quadro is one complete product photographed assembled.
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
- **Update (M4.2):** The frame precedence no longer applies; there is no `frameId` (D-046).
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
- **Update (M4.2):** IDs are unique across plates and text colors (D-046).
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
- **Status:** Superseded by D-046 (M4.2): the frame concept was removed; the Quadro is one complete product photographed assembled.
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
- **Status:** Superseded by D-046 (M4.2): the frame concept was removed; the Quadro is one complete product photographed assembled.
- **Date:** 2026-11-07.

### D-025 — `circle` plate shape

- **Decision:** `PlateShape` is `square | rectangle | circle`. No dimensions, aspect ratios, or equal-side constraints are assumed; dimension consistency checks wait for real measurements.
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-026 — Explicit frame clearing on plate selection

- **Context:** Product decision: switching to a plate that does not support frames must clear a previously selected frame.
- **Decision:** Pure `selectPlate(config, plateId, catalog)` sets the plate and, only when the new plate has `supportsFrame: false`, clears `frameId` and returns `cleared: ['frameId']` so the UI must announce it. An incompatible frame on a plate that supports frames, or an unknown plate, is not cleared; validation reports it. `getFrameOptions` lists frames offerable for a plate. This is the explicit, visible exception to "never auto-replace a selection" (D-005).
- **Alternatives:** Also clear any frame that becomes incompatible (not approved); implement only in the UI (untestable without components).
- **Status:** Superseded by D-046 (M4.2): the frame concept was removed; the Quadro is one complete product photographed assembled.
- **Date:** 2026-11-07.

### D-027 — Real product imagery

- **Context:** Approved product requirement: the final configurator must show actual product images for plates and frames.
- **Decision:** The preview and exported image are composed in layers from real product image assets supplied by the store: plate model (and color/finish variation), optional frame, and personalized text, with scaling, alignment, and positioning defined by catalog data. Color and finish are represented by images of the real variation; a CSS tint/filter/blend over a photograph is not an accurate representation of a ceramic color. Generic vector representations are temporary demonstration output only. Synthetic demonstration assets may be used for workflow tests but stay out of the production catalog and are labeled as such. Product imagery stays independent of `Configuration` and domain validation. No production photographs are generated or invented. M2 prepares the interface (preview slot, labeled placeholder); M3 implements the renderer; M1.3 adds real assets and the required catalog metadata.
- **Rationale:** Visual accuracy is a functional requirement; customers must see the physical product they are ordering.
- **Alternatives:** Vector-only rendering; tinting a single photograph per plate (rejected: misrepresents ceramic color).
- **Impact:** D-007 (SVG) was superseded by D-035 (Canvas 2D) in M3.1; D-009 (shared composition) is implemented for the preview and confirmed for export in M4. Adds pending items P-06–P-08.
- **Update (M4.1a):** Each model has one fixed color, so "color/finish variation" now means the model's own photograph (D-041); the no-tint rule is unchanged.
- **Update (D-050):** The preview is illustrative, not a photorealistic guarantee. Real TAAVI photographs are still required and preferred over synthetic images; AI-assisted removal of existing lettering from TAAVI's own photographs is acceptable. The no-tint and no-invented-product rules are unchanged.
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-028 — Demo mode with an isolated synthetic catalog

- **Context:** Production product photographs do not exist yet (M1.3b), so the preview cannot be exercised or tested end to end with real imagery.
- **Decision:** A Vite `demo` mode (`npm run dev:demo`, `npm run build:demo` → `dist-demo/`) loads `src/demo/demo-catalog.ts` and a "Modo demonstração" banner through a dynamic import guarded by `import.meta.env.MODE`. Demo entries use `demo-` IDs, names labeled "(demonstração)", and pending dimensions; they mirror the four production models, with `demo-quadro` made frame-capable only to exercise the frame flow. The production build must contain no demo data: `scripts/check-demo-isolation.js` scans every file in `dist/` (all chunks and assets) for demo markers, runs in CI after the build, and is checked against `dist-demo/` with `--expect-present` to prove it detects them. Playwright runs functional flows against the demo build and a smoke test against the production build.
- **Alternatives:** Test fixtures only (no manual demo); demo entries in the production catalog behind a flag (rejected: risk of shipping fake products).
- **Update (M4.2):** `demo-quadro` no longer has frame capability; it is drawn assembled with a synthetic wooden frame, and `demo-bandeja-ondulada-m-11` became `demo-bandeja-ondulada-g-11` (D-046).
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
- **Update (M4.2):** Frames no longer exist (D-046); the rule still applies to unavailable lettering colors, and an invalid second color keeps its section open (D-047).
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-031 — Same-origin asset paths in owner folders

- **Context:** Catalog-defined image paths must be safe and predictable before real files are registered (M1.3a).
- **Decision:** `AssetRef.src` must match `/catalog/{plates|frames|colors}/{owner-id}/{name}.{webp|png|jpg}` with kebab-case segments, where `owner-id` is the ID of the component that references it. The check is an allowlist at runtime (`isValidAssetPath`, `invalid-asset`), so external URLs, other schemes (`data:`, `javascript:`), traversal, query strings, and encoded characters are rejected; TypeScript types are not relied on. Assets are same-origin files under `public/catalog/` so a future canvas export is not tainted. File existence is verified by a test that lists `public/catalog/` at test time; there is no runtime fetch. Optional `widthPx`/`heightPx` are declared together as positive integers; M1.3b adds a check that they match the files. Originals stay outside the repository in TAAVI's source archive (P-10). Guide: `docs/07-product-assets.md`.
- **Alternatives:** Free-form paths checked only for non-blank (previous rule; too permissive); external hosting (out of scope).
- **Update (M4.1a):** The `colors` owner folder no longer exists; paths are `/catalog/{plates|frames}/{owner-id}/…` (D-041).
- **Update (M4.2):** The `frames` owner folder no longer exists; paths are `/catalog/plates/{owner-id}/…` (D-046).
- **Update (2026-11-08):** Selected reference photographs that TAAVI has the rights to may be versioned in `docs/reference-images/` as documentation (never served or registered); temporary working files and unrelated originals stay outside the repository.
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
- **Status:** Superseded by D-046 (M4.2): the frame concept was removed; the Quadro is one complete product photographed assembled.
- **Date:** 2026-11-07.

### D-034 — Optional normalized placement metadata

- **Context:** The renderer needs plate, frame, and text placement, but no values can be measured until real photographs exist.
- **Decision:** Placement uses `NormalizedBox` (`x`, `y`, `width`, `height` as 0–1 fractions of the image it belongs to, origin top-left): `PlateImage.objectBounds`, `PlateImage.text.area` (with optional `align`), and `FrameImage.platePlacement`. All are optional until calibrated; none are invented. Integrity (`invalid-placement`): finite values, non-negative origin, positive size, inside the image, a known alignment, and the text area inside `objectBounds` when both are present. A box is positioning metadata only: it does not describe the outline of a circular or irregular object or a frame opening; precise clipping/masking is an M3 decision. Typography and material effects (stamped or raised lettering) are not modeled (P-04).
- **Alternatives:** Pixel coordinates (tied to one file resolution); physical millimeters (dimensions pending).
- **Update (M4.2):** `FrameImage.platePlacement` no longer exists (D-046). For the assembled Quadro, `objectBounds` covers the whole product and the text area lies inside the ceramic.
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
- **Decision:** `scripts/generate-demo-assets.js` (`npm run generate:demo-assets`) writes deterministic synthetic PNGs to `src/demo/public/catalog/…`; the output is committed. They are deliberately not photograph-like: flat fills, hatched borders, an outlined text area, a "DEMO" stamp, and an embedded PNG comment "Synthetic demonstration image - not a TAAVI product photograph". They cover two square models and two scalloped trays (one image each), and two frames with back and front layers; the production catalog has no images, which exercises the pending state. Vite copies its public directory into every build, so `vite.config.ts` sets `publicDir` to `src/demo/public` only in demo mode and to the (currently absent) `public/` otherwise; demo files are never in the production public directory. Isolation is checked three ways: `scripts/check-demo-isolation.js` scans file contents and file names of `dist/` for demo markers (including the PNG comment); a unit test asserts `public/` has no `demo-` files; Playwright asserts the production build requests and serves no demo image. Tests verify the demo catalog's declared pixel sizes match the PNG headers, that no file is orphaned, and that every described image is labeled as a demonstration.
- **Alternatives:** Demo files in `public/` with a build-time exclusion step (rejected: easy to get wrong); generating images at build time (rejected: less reviewable, less deterministic).
- **Update (M4.2):** The demo images are now four model images and no frame layers; the Quadro image includes a synthetic wooden frame (D-046).
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-037 — Composition, scene, and missing-image rules

- **Context:** The preview must never show a configuration or product that differs from the selection, and must say why something is not shown.
- **Decision:** `composePreview(catalog, config, validation)` (pure) selects imagery by exact match (D-032, D-033) and returns the plate, frame, and text layers plus notice codes; it contains no product rules or coordinates. `buildScene` (pure) positions layers from the images' natural sizes and the catalog's normalized boxes, in painting order **frame back → plate → text → frame front**. Rules: (1) nothing is drawn for a plate that is not selected, unknown, or unavailable; (2) a color or shade that conflicts with the plate shows no photograph, never another variation; (3) a frame that fails configuration validation is not drawn; (4) a valid frame without registered imagery for the plate, without `platePlacement`, whose file fails to load, or whose layers differ in aspect ratio by more than 1% is not drawn, and the plate is shown alone; (5) a frame is only drawn together with its plate; (6) text is drawn only inside the plate photograph's calibrated `text.area` — without one it is not drawn and a message says so, while the entered text remains in the configuration and the summary; (7) nothing is drawn until every needed file has settled, so no partial composition flashes; (8) when a frame is used, the plate's `objectBounds` (the whole photograph when pending) are scaled uniformly to fit and centered in `platePlacement`, preserving the aspect ratio, and the front layer covers the frame image. Each state — not selected, color missing or invalid, image pending in the catalog, loading, file failed to load, frame problems, text area pending, text overflow — has its own pt-BR message beside the canvas (`aria-live="polite"`), distinct from the others. A catalog-pending image and a failed load are different states.
- **Update (M4.2):** The painting order is now **model photograph → text**; rules (3), (4), (5), and (8) and the frame notices no longer apply (D-046).
- **Status:** Approved.
- **Date:** 2026-11-07.

### D-038 — Provisional text fitting

- **Context:** Typography and text limits are pending (P-04); the preview still needs readable, honest text.
- **Decision:** Explicit line breaks (`\n`, `\r\n`, `\r`) are kept, including empty lines. Lines wrap at spaces; a word wider than the area is split between grapheme clusters (emoji sequences and accents stay intact). The font starts at 25% of the text area's height and shrinks by a factor of 0.9 per step down to a minimum of 8% of the area's height; line height is 1.2. If the text still does not fit at the minimum, it is drawn at the minimum size, unclipped, and a visible warning is shown; text is never truncated or clipped. Font (`system-ui`) and color (`#2b2b2b`) are provisional, alignment comes from the catalog (default center), and no stamped or raised effect is simulated. The constants live in `src/preview/text-fit.ts` and `src/preview/draw.ts`.
- **Alternatives:** Clipping to the area (rejected: silently hides text); a fixed font size (rejected: ignores the area).
- **Status:** Approved (provisional until P-04). The shrinking is superseded by D-055 (fixed lettering size); line breaks, wrapping, line height, and the overflow warning are kept.
- **Date:** 2026-11-07.

### D-039 — M4.1 in two slices; text styling is part of M4 acceptance

- **Context:** M4.1 combined a product-model refinement with advanced text customization.
- **Decision:** M4.1a (models and fixed properties; D-040, D-041) and M4.1b (advanced text; D-042) are separate, independently testable slices; M4.1b is not started with M4.1a. Because M4 (PNG export) is not implemented, the preview and the export must both render the M4.1b styling (font family, colors, position) from the same scene; this is a required M4 acceptance criterion.
- **Status:** Approved.
- **Date:** 2026-11-08.

### D-040 — Four product models; "Modelo" and "Moldura"; `scalloped`

- **Context:** TAAVI supplied the products currently sold: Placa cerâmica (10 cm x 10 cm), Quadro (20 cm x 20 cm), and two Bandeja ondulada M (~ 8 cm and ~ 11 cm). The earlier "Placa" and "Quadro" wording no longer fits: Quadro is now a product.
- **Decision:** The customer chooses a **Modelo** (code type `Plate`); the optional frame is **Moldura** (`Frame`). The four models are registered in the production catalog with the supplied names and size labels, which are shown as `displayName (sizeLabel)` and kept as supplied, approximations included. The Quadro (20 cm x 20 cm) is a separate model, not a frame. `PlateShape` gains `scalloped` for the two wavy trays as a classification only: no geometry is inferred and no frame rule depends on it. Physical dimensions stay `pending` (`sizeLabel` is display text). Every model is `supportsFrame: false` because no model is confirmed to take an optional frame; the production catalog has no frames. Provisional IDs (`placa-ceramica-10`, `quadro-20`, `bandeja-ondulada-m-8`, `bandeja-ondulada-m-11`) become permanent once TAAVI confirms them (P-12). The shape is no longer shown in the UI.
- **Alternatives:** Keeping "Placa" as the generic word (ambiguous with the Placa cerâmica model); inferring shapes for the trays (rejected: invented data).
- **Update (M4.2):** Superseded in part by D-046: there is no "Moldura" choice; the labels are now "Placa cerâmica — 10 × 10 cm", "Quadro — 20 × 20 cm", "Bandeja ondulada M — Aprox. 8 cm", and "Bandeja ondulada G — Aprox. 11 cm", shown as `displayName — sizeLabel`; and `bandeja-ondulada-m-11` was renamed `bandeja-ondulada-g-11`.
- **Status:** Approved (IDs pending confirmation; amended by D-046).
- **Date:** 2026-11-08.

### D-041 — Fixed ceramic color owned by the catalog; one image per model

- **Context:** TAAVI's pieces are all beige ("Bege"); the customer does not choose the ceramic color. Supersedes D-012 (color) and D-032.
- **Decision:** Color categories, specific colors, and the color selection are removed. `Plate.ceramicColor` holds the fixed color as supplied ("Bege") and is shown read-only as "Cor da peça". Configuration validation has no color rule. `Plate.image` is the model's single photograph (optional while pending); the former per-variation images, swatches, `colors` collection, and `/catalog/colors/` asset folder are gone. Integrity adds `empty-label` for blank `sizeLabel`/`ceramicColor`. No customer configuration is persisted, so no data migration is needed; a demo session simply restarts. Preview and export keep the real-image rule (D-027): the photograph is never tinted.
- **Status:** Approved.
- **Date:** 2026-11-08.

### D-042 — Advanced text customization design (planned, M4.1b)

- **Context:** The product needs font family, up to two lettering colors, and text positioning.
- **Decision (design only, not implemented):** (1) `fontFamily` is `serif` or `sans-serif` ("Com serifa" / "Sem serifa", default sans-serif), mapped to provisional system font stacks; real typography stays pending (P-04). (2) `textColorId` is required (no default) and `secondaryColorId` is optional with `secondaryRanges` as UTF-16 offsets snapped to grapheme boundaries; the lettering palette is catalog data (P-02). (3) One source of truth for position: nine presets (left/center/right × top/middle/bottom) plus a normalized manual position inside the calibrated text area; dragging keeps the line alignment; "Redefinir posição" restores the catalog default; the position survives model changes constrained to the new safe area. (4) Touch movement requires an explicit "Mover texto" mode so scrolling is not hijacked; keyboard positioning is supported. (5) Editing text keeps secondary ranges when they map unambiguously and removes or invalidates them otherwise; grapheme clusters are never split. (6) The handmade disclaimer is shown near the controls: "Todas as solicitações de personalização estão sujeitas à análise da TAAVI. Como nossas peças são produzidas artesanalmente, podem apresentar pequenas variações de formato, cor, acabamento e posicionamento em relação à pré-visualização." (7) A per-line text-length limit is a future rule, recorded in the backlog and not implemented.
- **Update (M4.2):** "Sem segunda cor" is replaced by an explicit "Remover segunda cor" action behind the "Usar segunda cor" disclosure; collapsing never clears anything (D-047).
- **Update (D-056):** the disclaimer copy is replaced by the three-paragraph text of D-056.
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
- **Update (M4.2):** The separate "Alinhamento das linhas" control was removed; the presets set the alignment and the position together, and dragging or nudging keeps the alignment (D-047). `alignPlacement` was removed.
- **Status:** Approved; implemented and accepted (2026-11-08).
- **Date:** 2026-11-08.

### D-008 — PNG export format

- **Context:** M4 completes the workflow with a downloadable image.
- **Decision:** PNG, rasterized client-side by painting the preview's scene on a separate canvas. Size: the base image's native pixel size (frame back when framed), never upscaled, longest edge capped at 4000 px with the aspect ratio preserved; dimensions are validated before a canvas is allocated (unusable or above 4000 × 4000 px of area → not exported, with a message). Background: opaque `#ffffff`, drawn by `drawScene` for preview and export alike. Filename: `taavi-{plateId}.png`, the ID reduced to `[a-z0-9-]`, at most 60 characters, never containing customer text. Export is blocked unless the configuration is valid and the scene has no preview notice, so a provisional color, a pending/failed image, an uncalibrated or broken selected frame, a pending text area, or overflowing text is never exported and nothing selected is silently left out. The blocked button stays focusable with `aria-disabled` and listed reasons. Canvas, context, drawing, encoding, object-URL, and download failures are caught and reported in pt-BR.
- **Alternatives:** JPEG (lossy, no exact colors), SVG/PDF (would need a second renderer), transparent background (inconsistent with the opaque preview, rejected by the owner).
- **Update (M4.2):** With frames removed (D-046), the export size is always the model photograph's native size.
- **Status:** Approved; implemented and accepted (2026-11-08).
- **Date:** 2026-11-08.

### D-009 — Shared composition for preview and export

- **Decision:** `composePreview` → `buildScene` → `drawScene` is the single path. Export reuses the preview's scene object (the same loaded images, measured text, colored segments, alignment, and position) and only chooses a different pixel width; nothing is recomposed.
- **Status:** Approved; implemented in M4.
- **Date:** 2026-11-08.

### D-045 — Curated imagery only; no customer uploads

- **Context:** Clarification of existing scope by the owner.
- **Decision:** Product photographs and visual assets are prepared and registered only by TAAVI in the version-controlled catalog. Customers cannot upload images (no file picker, drag-and-drop, paste, or image URL), and there is no customer image storage or upload API. Images are same-origin catalog assets only (D-031). Recorded as FR-09.
- **Status:** Approved.
- **Date:** 2026-11-08.

### D-046 — The Quadro is a complete product; no separate frame (M4.2)

- **Context:** Product clarification: the Quadro (20 × 20 cm) is sold as one complete product, a ceramic plate in a wooden frame. No model takes a separately chosen frame, so the frame selection, its validation, its layering, and its export blockers had no product to represent (P-13 answered: none).
- **Decision:** Option A — the Quadro is one catalog model with one photograph that shows it assembled, frame included. The frame concept is removed throughout: `Frame`, `FrameCompatibility`, `FrameImage`, `Catalog.frames`, `Plate.supportsFrame`, `FRAMELESS_SHAPES`, `Configuration.frameId`, the frame validation codes (`frame-not-supported`, `incompatible-shape`, `incompatible-plate`), the frame-only catalog codes (`duplicate-entry`, `unknown-reference`, `unreachable-compatibility`, `empty-list`, `frame-capability-conflict`, `unsupported-frame-shape`, `duplicate-variation`), `selectPlate`/`getFrameOptions` and the "frame cleared" notice, the frame composition and scene layers and notices, the "Moldura" field and summary row, and the `frames` asset folder. Rendering is the model photograph then the text; export uses the photograph's native size. The four labels are as supplied: "Placa cerâmica — 10 × 10 cm", "Quadro — 20 × 20 cm", "Bandeja ondulada M — Aprox. 8 cm", "Bandeja ondulada G — Aprox. 11 cm", shown as `displayName — sizeLabel`; no dimension beyond these labels is invented. `PlateShape` stays a classification only.
- **ID migration:** `bandeja-ondulada-m-11` → `bandeja-ondulada-g-11` (production) and `demo-bandeja-ondulada-m-11` → `demo-bandeja-ondulada-g-11` (demo), with the demo asset folder and generator output renamed. Nothing persisted these IDs (no storage, no backend), so no data migration is needed; the old IDs are now unknown references. The other three IDs are unchanged.
- **Rationale:** One photograph represents the real product exactly, keeps preview and export identical, and removes a whole class of states that could not occur.
- **Alternatives:** Option B — keep the frame as a layer fixed to the Quadro (rejected: needs calibrated frame and plate layers for no customer choice).
- **Supersedes:** D-014, D-022, D-024, D-026, D-033; amends D-016, D-019, D-028, D-030, D-031, D-034, D-036, D-037, D-040, D-008. Resolves P-03, P-09, and P-13.
- **Status:** Approved; implemented and accepted (2026-11-08).
- **Date:** 2026-11-08.

### D-047 — Simplified text position and lettering-color controls (M4.2)

- **Context:** UX review: a separate "Alinhamento das linhas" control duplicated what the presets already set, and the lettering-color radios and an always-visible second-color list made a simple choice look complex.
- **Decision:** (1) "Posição do texto" keeps the nine presets, each setting the line alignment (column) and the block position (row/column) together, drawn as a small glyph of aligned lines placed where the text will be. The selected preset is inverted with a heavier border and named in text ("Posição: Superior à esquerda." or "Posição personalizada."). The separate alignment control is removed. The directional buttons sit beside the presets ("Ajuste fino"); dragging, touch "Mover texto" mode, reset, and the arrow keys are unchanged, and none of them changes the alignment. (2) Lettering colors are labeled swatches with native radio semantics (visually hidden radio, chip, and visible name; the selected chip shows a check and a heavier border, never color alone). The primary color stays required with no default. (3) The second color sits behind a "Usar segunda cor" disclosure button (`aria-expanded`, `aria-controls`). Its swatches appear only when expanded, the swatch equal to the primary is disabled, and the "Aplicar/Remover segunda cor da seleção" actions appear only when a second color is chosen and the section is open. Collapsing only hides: the color and its trechos stay, summarized as "Segunda cor em uso: … (n trechos)." "Remover segunda cor" is the one action that clears the color and every trecho, and focus returns to the disclosure button. An invalid second color (e.g. equal to a newly chosen primary) keeps its section open, without the toggle, until it is replaced or removed (D-030).
- **Rationale:** Fewer controls with the same capabilities; visible state for every choice; no hidden data loss.
- **Alternatives:** Keep alignment as a separate control (rejected by the product owner); clear the second color on collapse (rejected: collapsing must not erase choices).
- **Status:** Approved; implemented and accepted (2026-11-08).
- **Date:** 2026-11-08.

### D-048 — Confirmed product facts for M1.3b-1 (2026-11-08)

- **Context:** TAAVI answered part of the M1.3b-1 input list. These are product facts supplied by the store, recorded verbatim; nothing is derived from them.
- **Confirmed:** (1) TAAVI has permission to use its product photographs. (2) The official product name is "Placa cerâmica (tamanho 10 x 10 cm)", verbatim (with "x", not "×"). (3) ~~The available lettering colors for now are Preto, Marrom, Azul, Verde~~ — superseded by D-049. (4) Lettering may be applied across the ceramic surface, never on the wooden frame.
- **Rules that follow:** No hex value is assigned to any lettering color until TAAVI supplies or approves one, so `Catalog.textColors` stays empty (P-02). The Quadro's text area is restricted to the ceramic part of its assembled photograph (consistent with D-046). The Placa's text area is set only after inspecting the actual catalog photograph; curved or rounded edges, bevels, and physical margins are not assumed printable. Reference photographs already shared are not catalog assets until inspected and approved (`docs/07-product-assets.md`).
- **Not yet applied:** the catalog still shows "Placa cerâmica — 10 × 10 cm" (D-046). Resolved by D-051: the customer-facing label stays "Placa cerâmica — 10 × 10 cm".
- **Status:** Approved (facts confirmed by TAAVI); recorded only, not implemented.
- **Date:** 2026-11-08.

### D-049 — Revised lettering-color names (2026-11-08)

- **Context:** TAAVI replaced the palette confirmed in D-048 (3).
- **Decision:** The approved lettering-color names are **Marrom, Azul, Verde, Amarelo, Laranja, Vermelho escuro**, in the order supplied. Preto is no longer approved and is not registered unless TAAVI approves it again.
- **Rules that follow:** Names only. No `#rrggbb` value is invented or approved automatically; any proposed digital value is reviewed and approved by TAAVI before it becomes a production color. `Catalog.textColors` stays empty until then (P-02).
- **Status:** Approved (names confirmed by TAAVI). Values and the first production palette in D-056: Amarelo became "Amarelo queimado" (pending), Laranja is excluded for now.
- **Date:** 2026-11-08.

### D-050 — Preview fidelity: illustrative, from TAAVI's own photographs (2026-11-08)

- **Context:** The product owner clarified that the preview illustrates the personalized piece; it is not a photorealistic guarantee of a handmade product. D-027's "visual accuracy" rationale was being read as pixel fidelity to the original photograph.
- **Decision:** (1) Real TAAVI product photographs are preferred over synthetic images. (2) AI-assisted removal of existing lettering is acceptable when preparing TAAVI's own photographs. (3) Minor differences in ceramic texture, lighting, color, shape, and finish are acceptable; an image is rejected only when artifacts materially harm its appearance or misrepresent the product. (4) Pixel-level fidelity to the original photograph is not required. (5) Priorities are useful and attractive previews, correct text placement, readable lettering colors, and reliable PNG export. (6) The disclaimer that personalization requests are subject to TAAVI's review and that handmade pieces may vary from the preview stays in the interface.
- **Unchanged:** no CSS tinting or recoloring of photographs to fake a ceramic color; no generated or substituted product images; no customer image uploads; no invented product data, including lettering-color values (D-049).
- **Applied:** `plate-no-text.png` (lettering removed from TAAVI's "Um passo de cada vez" photograph) is accepted as the candidate catalog image for the Placa cerâmica after a basic visual quality check (`docs/07-product-assets.md`).
- **Status:** Approved (product owner, 2026-11-08); recorded, not implemented.
- **Date:** 2026-11-08.

### D-051 — Placa cerâmica identity, label, and default placement (2026-11-08)

- **Decision:** (1) The permanent model ID is `placa-ceramica-10`. (2) The customer-facing label is "Placa cerâmica — 10 × 10 cm" (`displayName` "Placa cerâmica", `sizeLabel` "10 × 10 cm", unchanged). (3) The official supplied name, "Placa cerâmica (tamanho 10 x 10 cm)", is kept verbatim in product documentation (D-048). (4) The default text placement is centered horizontally and vertically in the text area (`text.align` `center`, block centered when the configuration has no custom layout). (5) The text-safe area stays within the usable ceramic surface.
- **Pending approval:** the final crop, the exact normalized calibration, and the six lettering-color values (review sheet: `docs/reference-images/review/review-sheet.png`).
- **Status:** Approved (product owner, 2026-11-08); not yet implemented.
- **Date:** 2026-11-08.

### D-052 — Debossed lettering (2026-11-08)

- **Context:** The lettering should look subtly engraved into the ceramic: an inner shadow, never an outer one, with the chosen colors staying dominant.
- **Decision:** `drawScene` paints the lettering colors exactly as before, then draws a shading layer over them (`src/preview/deboss.ts`). (1) An inverse mask: an opaque sheet with every glyph run cut out (`destination-out`). (2) A layer twice the mask's width: the mask is drawn whole in its right half with a shadow offset by one mask width, so the blurred shadow lands in the left half; a dark shadow offset down (top inner edge), then a light one offset up (bottom inner edge). (3) The same mask over the left half with `destination-out` removes the shading wherever there is no glyph, in one draw for all lines and colors. (4) The left half is drawn over the lettering. Offset and blur are fractions of the font size in device pixels (canvas shadows ignore the transform), so preview and export match; below 9 device pixels the effect is skipped. Offscreen canvases are pooled between frames. No drop shadow, stroke, halo, or `ctx.filter`; no customer controls; photographs untouched.
- **Strength:** offset 0.02, blur 0.025, shadow 0.25, highlight 0.14 of the font size: half of the first candidates (0.04, 0.05, 0.5, 0.28). At the Placa's text sizes the first candidates changed stroke centers by up to 59 of 255 levels (lettering visibly darkened throughout); half strength changes them by at most 4.
- **Engine notes:** WebKit casts no shadow for an image drawn fully off-canvas or for a sub-rectangle of a larger canvas, and per-call `destination-in` erases earlier runs; the technique avoids all three.
- **Status:** Architecture approved (2026-11-08) and implemented. The strength and the highlight are superseded by treatment B (D-072): one inner shadow at 0.012 em offset and blur, opacity 0.30. Pixel tests guard the technique, not the look.
- **Performance:** Under 4× CPU throttling a debossed redraw takes about 25 ms (about 40 fps while dragging) against 60 fps flat. No optimization is made without evidence from real devices.
- **Date:** 2026-11-08.

### D-053 — Placa photograph and calibration approved (2026-11-08)

- **Decision:** Approved by the product owner for the first production iteration, after reviewing the rendered crop, overlay, and colors: (1) the 640 × 640 crop of `plate-no-text.png`; (2) `objectBounds` `{ x: 0.0781, y: 0.0891, width: 0.8422, height: 0.8219 }`; (3) `text.area` `{ x: 0.145, y: 0.155, width: 0.71, height: 0.69 }` (enlarged to `{ x: 0.12, y: 0.14, width: 0.76, height: 0.74 }` by D-075); (4) centered default alignment and placement; (5) the photographic presentation as is, with no background removal or tinting.
- **Color review (not a production approval):** Marrom `#4a2a14`, Azul `#2b4a7a`, Verde `#2f4a36`, and Vermelho escuro `#7a1f1f` are visually acceptable. Amarelo `#e0b225` and Laranja `#e07a1f` stay proposals with a legibility concern; they are not removed or darkened automatically. All six stay in demonstration data until TAAVI approves production values (P-02).
- **Deboss (D-052):** half strength is technically accepted; its look is not yet approved.
- **Status:** Approved (product owner, 2026-11-08).
- **Date:** 2026-11-08.

### D-054 — Confirmed product facts for M1.3b-2 (2026-11-08)

- **Decision:** Supplied by the product owner: (1) the Bandeja ondulada M and G share one design, so both use the same photograph and placement, stored once per model folder as identical files (assets stay in their own model's folder); (2) the Quadro and Bandeja photographs (`quadro-no-text.jpg`, `ondulada.jpg`) are TAAVI's own, with the lettering removed by AI editing, which D-050 accepts; (3) both the Quadro and the Bandejas take colored lettering, like the Placa; (4) the processed catalog files are JPEG at quality about 90.
- **Not decided here:** crops, `objectBounds`, and `text.area` for these photographs stay proposals until the visual review approves them; IDs stay as in P-12; color values stay pending (P-02).
- **Calibration (M1.3b-2, product owner review 2026-11-08):** Quadro: 660 × 660 crop at x 427, y 156 of `quadro-no-text.jpg`; `objectBounds` (the whole framed product) `{ x: 0.0364, y: 0.0318, width: 0.9273, height: 0.9364 }`; `text.area` on the ceramic only, about 8% inside its edge, `{ x: 0.3009, y: 0.3494, width: 0.3589, height: 0.3589 }`. Bandejas: 1060 × 1060 crop at x 54, y 171 of `ondulada.jpg`; `objectBounds` `{ x: 0.0283, y: 0.0387, width: 0.9425, height: 0.9226 }`; `text.area` `{ x: 0.28, y: 0.265, width: 0.43, height: 0.43 }`, on the flat floor with a margin of about 0.01 from the wavy walls. All centered. The owner asked for a wider, shorter floor rectangle to be compared with the square; the widest one clear of the walls (`0.585 × 0.31`) fits one line fewer (M 2 lines instead of 3, G 3 instead of 4) for 2–3 more characters per line, so the square was kept as the meaningful-improvement test failed. The first proposed square (`0.2726, 0.2736, 0.4528`) touched the wall foot at its lower-right corner and was corrected.
- **Approval:** crops, bounds, centered placement, and the square text-area rule approved; the corrected square was chosen under the owner's rule "keep the square if the difference is negligible". M1.3b-2 accepted by the product owner (2026-11-08), with the permanent IDs (P-12) and the nominal Bandeja labels "8 × 8 cm" and "11 × 11 cm".
- **Status:** Approved (product owner, 2026-11-08).
- **Date:** 2026-11-08.

### D-055 — Fixed lettering size (2026-11-08)

- **Context:** TAAVI letters the pieces with physical molds of one size, so text that grows or shrinks with its length misrepresents the product.
- **Decision:** Each model's text placement carries a fixed `fontSize` as a fraction of its photograph's width (`TextLayout.fontSize`, per model, not per photograph: models sharing a photograph can differ in physical size). The size never depends on the text, its wrapping or line breaks, the alignment, or the position; text is never shrunk, enlarged, clipped, or truncated. Text taller or wider than the area is drawn at the same size with the `text-overflow` warning ("O texto não cabe na área do modelo. Reduza o texto ou use menos linhas."), and export is blocked. There is no customer size control.
- **Placa value:** (0.0753 since D-075) 0.0837 of the image width (53.6 px on the 640 px photograph), for a visible capital about **7 mm** tall on the 100 mm plate. The 7 mm is a provisional estimate (6–8 mm) by the product owner from the reference photograph of a real lettered 10 × 10 cm Placa, `docs/reference-images/um-passo-de-cada-vez-…webp`. It is not a verified mold or manufacturing measurement; a direct reading of that photograph gives about 6.4 mm (6.2–6.6).
- **Glyph height vs font size:** the canvas sets a nominal font size; the visible capital is 0.705 of it for the sans-serif stack and 0.693 for serif (measured in Chromium and WebKit on macOS; other platforms' system fonts differ by a few percent). Formula: `fontSize = capMm × (objectBounds.width ÷ ceramicWidthMm) ÷ 0.705`, so 7 × (0.8422 ÷ 100) ÷ 0.705 = 0.0837. At this size serif capitals are about 6.9 mm. The previous value, 0.08625 (55.2 px, half the former starting size), gave about 7.2 mm.
- **Pending state:** `fontSize` is optional, so a model without an approved size keeps the catalog valid. When such a model has text, nothing is drawn on the image, the `text-size-pending` notice says so ("O tamanho das letras deste modelo ainda não foi definido; o texto não aparece na imagem."), and export is blocked like any preview notice. There is no fallback to fitting and no guessed size. Validation rejects a `fontSize` that is not a finite number in (0, 1].
- **Other models (approved 2026-11-08 with the confirmed dimensions, P-01):** Quadro 0.0424 (the 100 mm ceramic, 282 of 660 px, never the 200 mm frame; 28.0 px); Bandeja ondulada M 0.1170 (80 mm, 0.9425 of 1060 px; 124.0 px; replaced by 0.0805 in D-074); Bandeja ondulada G 0.0851 (110 mm, same photograph; 90.2 px; replaced by 0.053 in D-073). M and G share a photograph but not a size. Same formula, with the measured cap ratio 0.7046 (0.705 rounded). The bandeja's dish measures 999 × 978 px in the photograph; its width is used, as for the Placa. Demo models use the same rule on their synthetic areas (demo-only values).
- **Alternatives:** Halving the fitted size (rejected: still resizes with the text); a size per photograph (rejected: Bandeja M and G share one photograph at different physical sizes).
- **Status:** Approved (product owner, 2026-11-08): Placa, then Quadro and Bandejas M and G.
- **Date:** 2026-11-08.

### D-056 — First production lettering palette and disclaimer (2026-11-08)

- **Decision:** The production catalog lists four lettering colors, in this order: Marrom `#4a2a14` (`marrom`), Azul `#2b4a7a` (`azul`), Verde `#2f4a36` (`verde`), Vermelho escuro `#7a1f1f` (`vermelho-escuro`). Every available color may also be the second color; the second must differ from the first (existing `same-as-primary` rule). The primary color stays required, with no default.
- **Pending and excluded:** Amarelo queimado (replacing Amarelo, D-049), proposed `#a87a10`, ID `amarelo-queimado`, awaits visual approval and is not in the production catalog. Laranja is excluded from the initial palette; reversible. The demo catalog is unchanged (its "(proposta)" entries, Amarelo and Laranja included, stay demo-only).
- **Legibility (measured against the median face color of each text area):** Marrom 4.8 / 6.9 / 7.0 : 1 on the Placa / Quadro / Bandeja; Azul 3.3 / 4.8 / 4.8; Verde 3.6 / 5.2 / 5.3; Vermelho escuro 3.8 / 5.5 / 5.6. Amarelo queimado would measure 1.4 / 2.1 / 2.1 (the earlier Amarelo 1.3 / 1.1 / 1.1, Laranja 1.1 / 1.6 / 1.6).
- **Disclaimer (replaces the copy of D-042):** three paragraphs below the controls: "A pré-visualização é ilustrativa. Como nossas peças são produzidas artesanalmente, o produto final pode apresentar pequenas variações de formato, textura, acabamento, posicionamento das letras e tonalidade das cores em relação à imagem exibida na tela." / "As cores também podem variar conforme a iluminação, as características da cerâmica e as configurações de cada dispositivo." / "Todas as solicitações de personalização estão sujeitas à análise e aprovação da TAAVI."
- **Consequence:** production configurations can be completed and exported as PNG for the first time.
- **Status:** Approved (product owner, 2026-11-08).
- **Date:** 2026-11-08.

### D-057 — Pre-beta UX refinement: Bandeja sizes, position section, overflow presentation (2026-11-08)

- **Bandeja sizes:** Bandeja ondulada M and G are shown as one option, "Bandeja ondulada" ("Disponível em dois tamanhos"), with a required "Tamanho" choice: "M — 8 × 8 cm" and "G — 11 × 11 cm" (letter plus the supplied size label). No size is preselected. This is a presentation table (`src/components/configurator/model-groups.ts`, keyed by the real IDs); each size stays its own catalog model, and the configuration stores only its ID, so validation, preview, export, and the file name (`taavi-bandeja-ondulada-g-11.png`) are unchanged. Choosing the group clears `plateId`; while no size is chosen the missing field is called "Tamanho" and the preview asks for it. Changing the size changes only `plateId`. The summary shows "Modelo" and "Tamanho" as separate rows for every model. The table belongs with its catalog and is passed to `App` (`modelGroups`): production uses `MODEL_GROUPS`; demo mode passes `demoModelGroups` from `src/demo/demo-catalog.ts` ("(demonstração) Bandeja ondulada" over `demo-bandeja-ondulada-m-8` / `-g-11`), so both run the same grouping code and production code never names a demo ID (D-028).
- **Position section:** one "Posição do texto" section without the visible captions "Posições predefinidas" and "Ajuste fino" (kept as accessible group names); a compact arrow pad beside the nine presets (36 px buttons, 44 px on coarse pointers); one status line announces the position ("Posição: Centro." or "Posição personalizada: horizontal 34%, vertical 50%.", "sem espaço livre" for an axis without free space). Replaces the separate "Posição personalizada." and "Horizontal X%, vertical Y%." lines of D-044/FR-05.15.
- **Overflow presentation:** detection, the fixed size (D-055), the layout, and export blocking are unchanged; all text stays drawn, never clipped, truncated, or resized. While the text overflows, the preview draws a dashed outline (dark dashes over a light halo) of the calibrated text area on top of the image; it is painted by the preview canvas after `drawScene`, never by `drawScene`, so no export contains it. For vertical overflow the message states the lines over the area's capacity (`floor(area height ÷ line height)`): "O texto não cabe na área do modelo: 1 linha a mais. Reduza o texto ou use menos linhas." ("2 linhas a mais", …). Horizontal-only overflow keeps the general message.
- **Status:** Approved (product owner, 2026-11-08).
- **Date:** 2026-11-08.

### D-058 — Mobile-first layout and TAAVI visual identity (2026-11-08)

- **Order:** the preview first (approved strategy A), then four steps: "Modelo e tamanho", "Texto e cores", "Posição do texto", "Revisar personalização". The review holds the full summary (bold labels with a colon, regular values; field order unchanged), the configuration status, the approved disclaimer (D-056, wording unchanged), the export reasons, and "Exportar imagem" as the last control of the page. No "Continuar" buttons.
- **Steps:** below 48 rem they are a WAI-ARIA accordion. Each header is a button in an `h2`, with `aria-expanded` and `aria-controls`. One step is open at a time; closed steps stay mounted with `hidden`, so every input and choice is kept. Focus stays on the activated header (it focuses itself, since Safari does not focus tapped buttons); no input is focused automatically. The page scrolls only when the opened header is off screen or under the preview band, without animation when motion is reduced. Each header shows "Concluído"/"Pendente" and a one-line summary. At 48 rem and above, all steps are open with plain headings, and the preview is sticky beside them.
- **Preview band (phones):** space is reserved from the start. Once a model is chosen the band sticks to the top. It is compact (`clamp(150px, 28svh, 230px)`), reduced while "Texto e cores" is open (`clamp(110px, 20svh, 170px)`; tied to the step, not to focus, so leaving the field never shifts the page), and larger while "Posição do texto" is open (`clamp(200px, 45svh, 420px)`). `scroll-padding-top` keeps focused or revealed elements below the band (WCAG 2.4.11).
- **Identity:** tokens `--color-bg #faf8f5`, `--color-surface #f4ede6`, `--color-sand #e6d8cb`, `--color-text #302a26`, muted `#5f554d`, control borders `#8c7b6b` (contrast 13.3 / 6.9 / 3.8 on the background); 5 px radius; interface font Red Hat Display (latin 400/500/700), self-hosted from `@fontsource/red-hat-display` 5.3.0 (OFL-1.1). The canvas lettering fonts and sizes are unchanged. No logo in the header.
- **Status:** Approved (product owner, 2026-11-08, M4.6). Implementation pending acceptance.

### D-059 — Line alignment independent of the block position (2026-11-08)

- Supersedes the D-047 coupling of alignment and preset column. **Model:** the text block is the widest line by all lines (`bounds`), placed by `x`, `y` as fractions of the free space in the calibrated area (D-044). The lines are then aligned inside the block: left edges at `bounds.x`, centers at `bounds.x + width/2`, or right edges at `bounds.x + width`. Alignment never moves the block. Overflow on an axis keeps `x` horizontally and centers vertically, also independent of the alignment.
- **Controls:** "Alinhamento das linhas" offers three icon-only radios named "Alinhar à esquerda", "Centralizar texto", "Alinhar à direita" (default: the catalog alignment, center). Presets, moves, dragging, and "Redefinir posição" change only the position; reset restores the catalog position and keeps the chosen alignment.
- **Position modes:** "Posição do bloco" has two exclusive modes (a segmented radio group). "Escolher posição" shows the nine presets; "Ajustar manualmente" shows the arrow pad (2% / 10% with Shift, arrow keys) and enables dragging on the preview for mouse, pen, and touch. Switching modes keeps the position. "Mover texto" is removed, since manual mode enables dragging. Leaving manual mode, or closing the step, restores touch scrolling. The arrow-key instructions are a visually hidden description of the pad.
- **Status:** Approved (product owner, 2026-11-08, M4.6). Implementation pending acceptance.

### D-060 — TAAVI signature on every image (2026-11-08)

- The official arch symbol (`docs/reference-images/logo/logo-taavi.png`, copied unmodified to `src/assets/brand/taavi-arch.png`, aspect preserved) and "© TAAVI" are drawn (on a light pill until D-065, now without background, 1.5× larger) at the bottom-right of every composition. They are the scene's last layer, painted by `drawScene`, so the preview and the PNG are identical at any resolution. Geometry is relative to the shorter side: pill height 0.055, margin 0.022, pill opacity 0.64, ink opacity 0.72 (the first values × 1.1 and × 0.8; M4.6 refinement). The pill sits below and right of every model's text area and never overlaps the lettering; on the Quadro it lies on the frame's bottom rail.
- The signature is not interactive and cannot be removed. If the mark cannot load, the preview says so ("Não foi possível carregar a assinatura TAAVI da imagem. Recarregue a página para exportar."), the notice blocks export, and `renderPng` refuses a scene without it (`no-watermark`). It identifies TAAVI's images; it does not prevent copying or removal.
- **Status:** Approved (product owner, 2026-11-08, M4.6). Implementation pending acceptance.

### D-061 — Bandeja ondulada photograph before the size is chosen (2026-11-08)

- A model group may name the size whose photograph stands in before a size is chosen (`previewPlateId`, presentation data beside the grouping; production: `bandeja-ondulada-m-8`, whose file is byte-identical to G's). Choosing "Bandeja ondulada" shows that photograph at once, without lettering, with "Selecione o tamanho para visualizar a personalização.". The configuration still has no model (`plateId: null`), no size is preselected or stored, and export stays blocked ("Falta escolher: Tamanho."). Choosing M or G draws the lettering with that size's calibration. Switching sizes re-renders at once, and an already loaded photograph is never requested again.
- **Status:** Approved (product owner, 2026-11-08, M4.6). Implementation pending acceptance.

### D-062 — Optional "Observação" before export (2026-11-08)

- Requested by the product owner (2026-11-08): an "Observação" field before exporting. It is a configuration field `note` (raw user input, default `''`), kept exactly as typed, with no validation, no length limit, and no effect on completeness or export. It is never drawn: the preview and the PNG show only the piece (D-027), and the hint says "Opcional. Não aparece na imagem exportada.". With no backend (out of scope) the note is not sent anywhere; how it reaches TAAVI (e.g., in the image, in the filename, or copied into the order message) is an open decision.
- **Status:** Approved as requested (product owner, 2026-11-08). Destination and any length limit open; implementation pending acceptance.

### D-063 — Overflow made explicit; line breaks limited to the area (2026-11-08)

- Requested by the product owner (2026-11-08): block export until every pending item is resolved, highlight "O texto não cabe na área do modelo…", and do not allow more line breaks than the area holds. Export was already blocked by every pending item; the change is in how it is shown. Each export reason is now named (preview problems in the preview's words, without repeating "Falta escolher" items); the blocked button looks inactive and stays focusable for its description (FR-07.7).
- Overflow is shown as an error under the "Texto" field (`aria-invalid`) and in the error style in the preview. A line break that would take the text past the area's line capacity, `floor(area height ÷ line height)` at the fixed lettering size (D-055), is refused, whether typed or pasted, also into an empty field; the text and caret are restored and "Este modelo comporta no máximo N linhas." is announced. Only added breaks are refused: text without new breaks and deletions are always accepted, so the customer's text is never cut, and wrapping past the area still overflows and blocks export. Without a calibrated area or an approved lettering size there is no limit. This revises "text is never refused" for line breaks only.
- **Status:** Approved (product owner, 2026-11-08). Implementation pending acceptance.

### D-064 — Marrom selected by default (2026-11-08)

- Requested by the product owner (2026-11-08), revising D-042's "no default" for the lettering color. The catalog may name `defaultTextColorId`, an available color (`validateCatalog`: `unknown-reference` otherwise); the configuration starts with it, and the customer can change it. Production: Marrom. The demo catalog names none, so it keeps the explicit choice and the provisional color (D-043).
- **Status:** Approved (product owner, 2026-11-08). Implementation pending acceptance.

### D-065 — Larger signature without background (2026-11-08)

- Requested by the product owner (2026-11-08): the TAAVI signature 50% larger, with no background. Height 0.055 → 0.0825 of the shorter side (× 1.5); the light pill is no longer painted; the mark and "© TAAVI" keep opacity 0.72 and the same relative layout. It still sits below and right of every model's text area (top at 0.8955 of the height; the lowest area ends at 0.845, 0.88 since D-075). Without the pill its contrast depends on the photograph behind it.
- **Status:** Approved (product owner, 2026-11-08). Implementation pending acceptance.

### D-067 — Production palette revised and extended (2026-11-08)

- Supplied by the product owner (2026-11-08): Marrom `#802b00` (was `#4a2a14`), Azul `#002b80` (was `#2b4a7a`), Verde `#006600` (was `#2f4a36`), and new colors Laranja escuro `#b25900`, Amarelo queimado `#b38f00` (replacing the proposed `#a87a10`), Preto `#000000`. Vermelho escuro `#7a1f1f` was not mentioned and is kept. Display order: Marrom, Azul, Verde, Vermelho escuro, Laranja escuro, Amarelo queimado, Preto; IDs `laranja-escuro`, `amarelo-queimado`, `preto` are new, existing IDs unchanged. Each may be the second color. Marrom stays the default (D-064). The demo catalog is unchanged.
- **Status:** Approved (product owner, 2026-11-08). Implementation pending acceptance.

### D-068 — M4.7 corrections: letter case by typeface, centered trays, presets only, working second color (2026-11-08)

- Requested by the product owner (M4.7, 2026-11-08).
- **Letter case:** "Com serifa" keeps the text as typed; "Sem serifa" letters in capitals only (as the reference pieces do). `letteringText(text, fontFamily)` uppercases per grapheme in pt-BR and keeps a grapheme whose capital changes length (e.g. "ß"), so character offsets, second-color ranges, and the stored text are unchanged; switching back to "Com serifa" restores the mixed case. The preview, summary, line limit, and PNG use the lettered text; the field shows capitals with CSS. Physical sizes (D-055) are unchanged: the 7 mm calibration is a capital height, so it already holds for capitals; lowercase in "Com serifa" uses the same font size.
- **Trays centered:** `TextLayout.fixedPlacement` (catalog data) on Bandeja ondulada M and G. `placementFor` returns the default center for such a model wherever a placement is used (composition, review, form); the configuration's `textLayout` is not migrated or cleared, so other models keep their position. No presets or alignment are shown on the trays; the shared photograph before the size (D-061) is unchanged. The demo tray is not fixed (demo catalog unchanged).
- **Manual positioning removed** (supersedes D-059's second mode and the D-044 drag/keyboard movement): only the nine presets and the line alignment, for Placa and Quadro. The domain keeps a normalized position, so no migration is needed.
- **Second color, root cause:** "Aplicar segunda cor à seleção" was enabled by React's `onSelect`, which fires only on mouse or key release; selections made with touch handles (iOS, Android) or programmatically never enabled it, and the disabled button gave no reason. The buttons were also in the text field, far from the swatches. Fix: the actions moved into the second-color panel and are always enabled; they read the textarea's selection at press time (a textarea keeps its selection after blur); a `selectionchange`/`select`-based indicator shows the selected letters; the result or the missing selection is announced politely.
- **Help:** short hints for the font rule, the second color, the presets, and the trays. Summary labels "Alinhamento:" and "Posição:".
- **Open:** whether lowercase serif lettering is manufacturable (no character-set rule exists, P-04/P-14); accented serif capitals overshoot their line slot by about 0.035 em in Chromium (pre-existing).
- **Status:** Approved as requested (product owner, 2026-11-08). Implementation pending acceptance.

### D-069 — Second color applied on tap (2026-11-08)

- Requested by the product owner (2026-11-08): only the selected second color shows its name; the color is applied as soon as it is chosen, so "Aplicar segunda cor à seleção" is removed; the component should be more intuitive.
- Tapping a second-color chip reads the "Texto" selection (as in D-068) and applies the color to it at once; the chip reacts to every activation (click, Space, arrow keys), also when already selected, so the same color can be applied to further selections. Without a selection the tap only chooses the color and says to select letters and tap again (approved option).
- The help line and the "Seleção" indicator come before the chips. "Remover segunda cor da seleção" and the trecho count are replaced by a list of the colored trechos, each with "Remover"; focus stays in the list. "Remover segunda cor" still clears the color and all trechos. The domain is unchanged (one second color, ranges as before).
- **Status:** Approved (product owner, 2026-11-08). Implementation pending acceptance.

### D-070 — "Reiniciar configurações" (2026-11-08)

- Requested by the product owner (2026-11-08): an option that resets every field and choice. "Reiniciar configurações" sits in "Revisar personalização", under the summary, so "Exportar imagem" stays the last action (D-058). It asks first ("Reiniciar apaga o modelo, o texto, as cores e a posição; a observação é mantida. Deseja continuar?", "Sim, reiniciar" / "Cancelar", focus on "Cancelar"). Confirming mounts a fresh configurator: the configuration returns to its initial state (catalog default lettering color, D-064) except the note ("Observação", D-062), which is kept as typed (product owner request, 2026-11-09), and the open step, second-color section, size pending, and messages reset too; focus goes to the first step and "Configurações reiniciadas." is announced.
- **Status:** Approved (product owner, 2026-11-08). Implementation pending acceptance.

### D-071 — Unified "Cores do texto" with whole-word highlighting (2026-11-08)

- Approved by the product owner (M4.7c, 2026-11-08), superseding the character selection of D-042, D-068, and D-069 and the "Usar segunda cor" disclosure of D-047. Individual-letter highlighting is no longer offered.
- One "Cores do texto" section: "Cor do texto" always visible; a switch "Destacar parte(s) do texto" (off by default, `Configuration.highlightEnabled`); with it on, "Cor de destaque" (the primary disabled; at most two colors) and "Toque nas palavras que deseja destacar" with the text as compact word toggles. Each word occurrence is independent; a second tap restores the primary color; the preview updates at once.
- Words: `[\p{L}\p{M}\p{N}]+` joined by an inner hyphen or apostrophe; never cutting a grapheme. Punctuation, spaces, line breaks, and emoji stay primary. Highlights are stored in `secondaryRanges` (one range per word), so the renderer, preview, and PNG are unchanged.
- Edits: each highlight is followed on its own through the edit's position (`remapRanges`: caret, else prefix/suffix); it survives only as the same letters on a whole word, so it is never moved to another identical word. Edited words and ambiguous positions lose their highlight, with the formatting-removal notice.
- Validation: off, or on with no word → only the primary is validated (never blocks export); with words → a highlight color is required and must be available and different from the primary; ranges must be whole words.
- Conflict: choosing the highlight color as the primary swaps the two and keeps the words, announced as "As cores foram trocadas: destaque agora em {cor}." (silent while highlighting is off).
- Off keeps the color and words; on restores them (if their words were not edited).
- Selected word tokens are filled in the highlight color with white or black letters, whichever contrasts more (WCAG 2 ratio); every production color reaches at least 4.5:1 (Amarelo queimado: black, 6.85:1; Laranja escuro: white, 4.86:1). The check mark and `aria-pressed` are unchanged.
- Refinement (product owner, 2026-11-09): the word toggles ignore the text's line breaks and wrap to the available width as one sequence; each break (with the spaces and blank lines around it) shows as one space. Presentation only: the stored text, its line breaks, and the range offsets are unchanged, so the text field, preview, PNG, and order message keep every line break.
- **Status:** Approved (product owner, 2026-11-08). Implementation pending acceptance.

### D-072 — Lettering fonts, letter spacing, and deboss treatment B (2026-11-08)

- Approved by the product owner (2026-11-08) after a side-by-side comparison on the Placa, Quadro, and Bandeja G photographs at the same 7 mm capital, measured against the real "TRANSBORDA." on the Quadro, in Chromium and WebKit. Supersedes the provisional system stacks (D-042, P-14 typefaces) and the D-052 strength; resolves the D-066 evaluation.
- **"Sem serifa": Quicksand Bold 700**, uppercase (D-068), **letter spacing 0.05 em**. Closer to the stamped letters than Nunito ExtraBold on stroke ÷ capital (0.19 vs real 0.167; Nunito 0.217) and ink ÷ capital² (4.38 vs 4.06; Nunito 5.0); with 0.05 em its "TRANSBORDA." width ÷ capital matches the real 10.72 (0.048–0.061 em for an exact match in WebKit and Chromium).
- **"Com serifa": Gelasio Regular 400**, mixed case kept, no letter spacing. Georgia's metrics (capital 0.693), so serif wrapping and size are unchanged; Gelasio Bold was 45% heavier than the real strokes and changed the wrapping.
- **Files:** `@fontsource/quicksand` and `@fontsource/gelasio` 5.3.0 (SIL OFL 1.1; Quicksand declares the Reserved Font Name "Quicksand", which only restricts modified versions: the files are used unmodified), Latin and Latin Extended `woff2` subsets, bundled by Vite and served from the app's own origin. Registered with the Font Loading API under "Taavi Lettering Sans" / "Taavi Lettering Serif", never a system font name. One configuration, `src/preview/lettering-fonts.ts`, holds family, weight, files, fallback stack, capital ratio, spacing, and size scale.
- **Calibration (D-055):** catalog sizes unchanged; drawn size = catalog size × `sizeScale`: Quicksand 0.7046 ÷ 0.700 ≈ 1.007 (the capital stays 7 mm), Gelasio 1.
- **Loading:** both fonts start loading at startup; the scene waits for the configured one (nothing drawn, "Carregando imagem…"). If it fails, the text is drawn with the system fallback, `font-error` is shown, and export is blocked, so no PNG is made with another font.
- **Spacing:** every line and color run is drawn left-aligned at the start computed from its measured width; width = unspaced width + spacing × (graphemes − 1) (`spacedWidth`), used for wrapping, line limit, overflow, alignment, and run positions. Drawing uses canvas `letterSpacing` where available; elsewhere (older Safari) each grapheme is drawn at the width of the text before it plus the spacing so far, which keeps accents with their letters. In Chromium and WebKit the two paths drew the test samples ("SMALL STEPS", "AÇÃO É CAFÉ", under a scale) with identical pixels; the test allows 2% for kerning across graphemes.
- **Deboss treatment B:** one inner shadow, offset 0.012 em, blur 0.012 em, opacity 0.30, no highlight, inside the glyphs only (same mask technique as D-052). 95–96% of fully covered glyph pixels stay within ΔE76 5 of the chosen Azul or Marrom (Chromium 95.3%, WebKit 96.3%), against about 80% for the previous effect in the comparison.
- **Effect on wrapping:** "Sem serifa" fits one character fewer per line (Placa and Quadro 14 instead of 15; Bandeja M 5 instead of 6; Bandeja G 8 instead of 9; capitals of a typical phrase), so some texts gain a line: "O QUE NÃO CABE TRANSBORDA." takes 3 lines on the Placa and Quadro (was 2) and overflows the Bandeja G (5 lines, 4 fit); "EU TE AMO" takes 2 lines on the Bandeja G (was 1). "Com serifa" wraps as before on every model.
- **Status:** Approved (product owner, 2026-11-08). Implemented; release subject to a check on a real iPhone or Android phone, preferably beside a real TAAVI piece.

### D-073 — Bandeja ondulada G lettering sized from the real piece (2026-11-08)

- **Context:** the product owner reported that on the real Bandeja ondulada G, "PROSPERIDADE" fits in one row (reference: `docs/reference-images/travessa-artesanal-da-prosperidade-…`). At the 7 mm capital of D-055 (0.0851) the preview fitted 8 capitals per line, so the word was split. The Placa and the Quadro look right and are unchanged; the Bandeja M is unchanged.
- **Decision:** Bandeja ondulada G `fontSize` 0.053 (56.2 px of the 1060 px photograph; drawn at 56.5 px in Quicksand, D-072). The largest size at which "PROSPERIDADE" fits the unchanged text area (455.8 px) in Quicksand Bold with its spacing is 0.05367 (Chromium and WebKit agree); 0.053 leaves about 1%. Capitals about 4.4 mm (serif 4.3 mm), consistent with the reference photograph (roughly 4–5 mm, estimated through its perspective, not measured). Text area and position unchanged.
- **Effect:** "PROSPERIDADE" takes one line (99% of the width; "Prosperidade" in "Com serifa" 73%); about 13 capitals per line instead of 8; 6 lines fit instead of 4 (the D-063 line limit follows). "O QUE NÃO CABE TRANSBORDA." no longer overflows (3 lines); "EU TE AMO" takes one line again.
- **Open:** the 4.4 mm is derived from fitting the word, not from a mold measurement; a measured letter height of the G stamps would replace it.
- **Status:** Approved (product owner request, 2026-11-08). Implemented, pending visual acceptance.

### D-074 — Bandeja ondulada M lettering sized from the real piece (2026-11-08)

- **Context:** the product owner confirmed the Bandeja G size (D-073) and reported that "AMIZADES" fits in one row on the real Bandeja ondulada M. At the 7 mm capital of D-055 (0.117) the preview fitted 5 capitals per line.
- **Decision:** Bandeja ondulada M `fontSize` 0.0805 (85.3 px of the 1060 px photograph; drawn at 85.9 px in Quicksand, D-072), the same method as D-073: the largest size at which "AMIZADES" fits the unchanged text area in Quicksand Bold with its spacing is 0.08131 (Chromium and WebKit agree), less about 1%. Capitals about 4.8 mm (serif 4.7 mm). Text area and position unchanged.
- **Effect:** "AMIZADES" takes one line (99% of the width; "Amizades" in "Com serifa" 80%); about 8 capitals per line instead of 5; 4 lines fit instead of 3 (the D-063 line limit follows). "BEM-VINDOS AO NOSSO LAR" no longer overflows (4 lines); "CASA DA ANA E DO PEDRO, DESDE 2024" still does (5 lines).
- **Open:** derived from fitting the word, not from a mold measurement.
- **Status:** Approved (product owner request, 2026-11-08). Implemented, pending visual acceptance.

### D-075 — Placa cerâmica: smaller lettering and a larger text area (2026-11-09)

- **Context:** the product owner reported that the Placa cerâmica may take up to 7 rows, asked for its lettering to be 10% smaller, and asked for the text area to be enlarged so the customer can write closer to the edges; then (2026-11-09) asked for 8 lines, gained by extending the area downwards only, with the size unchanged. At 0.0837 (D-055) in the area of D-053 (about 8 mm inside the plate edge), 6 lines and about 14 capitals per line fitted.
- **Decision:** Placa `fontSize` 0.0837 → **0.0753** (−10%; 48.2 px of the 640 px photograph, drawn at 48.5 px in Quicksand and 48.2 px in Gelasio, D-072); capitals about 6.3 mm. `text.area` `{ x: 0.145, y: 0.155, width: 0.71, height: 0.69 }` → **`{ x: 0.12, y: 0.14, width: 0.76, height: 0.74 }`**: about 5 mm inside the plate's side edges, 6 mm below its top edge, and 4 mm above its bottom edge (was about 8 mm all round), still clear of the rounded rim (checked on an overlay of the photograph). The height fits 8 lines (8.1 line heights of 1.2 × the size); 0.72, first proposed for 7 lines, was extended downwards only, so the area's center is about 0.01 below the plate's and centered text sits about 6 px lower.
- **Effect:** 8 lines (the D-063 line limit follows) and about 16 capitals per line in "Sem serifa" (21 characters in "Com serifa"). The lowest text area now ends at 0.88 of the height, still above the TAAVI signature (top at 0.8955, D-065). The Quadro and the Bandejas are unchanged.
- **Open:** the 6.3 mm capital and the 5 mm margin follow the owner's request, not a mold measurement.
- **Status:** Approved (product owner request, 2026-11-09). Implemented, pending visual acceptance.

### D-076 — Sharing the customization: Native Share with a WhatsApp fallback (M5.1, 2026-11-09)

- **Context:** customers send their customization to TAAVI on WhatsApp. A web page cannot attach a file to a WhatsApp chat, choose its recipient, or know whether a message was sent; the device's share sheet (Web Share API) can hand over a PNG, and a `wa.me` link can open a chat with a message typed in.
- **Decision (approved strategy and implementation, product owner, 2026-11-09):** "Revisar personalização" ends with, in order: **"Compartilhar personalização"**, **"Baixar imagem"** (the former "Exportar imagem", FR-07), and **"Abrir WhatsApp da TAAVI"**.
  - _Share:_ the share sheet gets the watermarked PNG (`taavi-{plateId}.png`, the same `renderPng` output as the download) and, where the browser accepts both, the order message (FR-10). The customer chooses WhatsApp and the TAAVI chat; the app never preselects a recipient. Offered only where `navigator.share` and `navigator.canShare` exist and `canShare` accepts a PNG file (and then the prepared file); otherwise hidden, and "Baixar imagem" is the main action.
  - _Prepared PNG:_ the share sheet opens only from the tap itself, and rendering takes longer than browsers keep that permission, so the PNG is rendered in the background 300 ms after the last change, only while the configuration is exportable (every export blocker clear, so fonts, photograph, and signature are loaded) and the section is open (always on wide screens). It belongs to one export revision (`exportRevision`: every configuration field but the note, which is never drawn); any other change withdraws it at once and "Preparando imagem para compartilhar…" is shown until the new one is ready, so a stale image is never shared. The tap calls `navigator.share()` directly; a refusal is reported, never retried automatically.
  - _WhatsApp:_ a link to `https://wa.me/{number}?text={order message}` (new tab), after two steps telling the customer to download the image and attach it. No file is passed through the URL. The number lives in `src/config/contact.ts` (`TAAVI_WHATSAPP_NUMBER`) and is not supplied yet (P-16): without a valid number (8–15 digits, no leading zero) the link and its steps are not shown. While blocked it is not a link (no `href`, `aria-disabled`, the export reasons as its description).
  - _Never in sequence:_ each action starts only from its own tap; sharing never opens WhatsApp and the link never opens the share sheet.
  - _Messages:_ completed "Confira no WhatsApp se a imagem e os detalhes foram enviados para a TAAVI."; cancelled "Compartilhamento cancelado. Sua personalização continua aqui."; failed (including a render failure) "Não foi possível compartilhar. Você pode baixar a imagem e enviá-la pelo WhatsApp da TAAVI."; preparing "Preparando imagem para compartilhar…". Nothing says the request was sent, received, or confirmed: a completed share only means the sheet closed after a target was chosen. Sharing never changes the configuration.
  - _Blockers:_ the export blockers (FR-07) apply to all three actions.
  - _Look:_ "Compartilhar personalização" is filled (the main action), "Baixar imagem" and the WhatsApp link outlined; without sharing, "Baixar imagem" is filled. The export button styles are now scoped to `.export`, because the later `.button` rule had silently overridden them: the filled style and the dashed blocked style were never shown before.
- **Scope:** no backend, no WhatsApp Business API, no Nuvemshop, no stored state; the order message is a request for a quote, not order management (out of scope, 01-product-vision). TAAVI is spelled in capitals in the UI, messages, and documentation (product owner, 2026-11-09); the signature drawn on the preview and the PNG reads "© TAAVI" (was "© Taavi", D-060, D-065; product owner, 2026-11-09), with the same mark, size, and opacity. Internal identifiers (e.g. the "Taavi Lettering Sans" font family name, `taavi-` file names) are unchanged.
- **Supersedes:** "Exportar imagem" as the last action of the page (D-058, FR-07.9): "Baixar imagem" is the last button, followed by the WhatsApp link when configured.
- **Status:** Approved (product owner, 2026-11-09). Implemented; release subject to manual checks on a real iPhone (Safari) and Android phone (Chrome) (05-backlog, M5.1).

### D-077 — Pilot hosting on Cloudflare Pages by Direct Upload (M5.2, 2026-11-09)

- **Context:** Native Share needs HTTPS, and the store pilot needs a stable address for a QR Code, with no backend and no change to the Nuvemshop store.
- **Decision (approved by the product owner, 2026-11-09):** Cloudflare Pages, project `crie-com-a-taavi` in an account TAAVI controls; production branch `main` (`https://crie-com-a-taavi.pages.dev`, subject to availability), beta branch `beta`. The production build (`dist/`, never demo assets) is uploaded with a pinned Wrangler (`4.153.0`) from a verified local build; no Git integration. `npm run release:verify` runs every gate and stamps the build with its commit and fingerprint; `scripts/deploy-pages.js` deploys only a stamped, unchanged build of HEAD from a clean tree, and production only with `--confirm-production`, after the beta's real-device checks. The same `dist/` goes to beta and production.
- **Indexing:** `public/_headers` sends `X-Robots-Tag: noindex, nofollow` on every path (and `nosniff`, a referrer policy, long caching for hashed `/assets/*`); no `robots.txt` blocking, so crawlers see the header. No authentication for the pilot.
- **Rollback:** the dashboard's "Rollback to this deployment", or redeploying a `pilot-*` tag; never deleting the project, which would free the name behind the QR Code.
- **QR Code:** points to the verified production address only, titled "Crie sua peça com a TAAVI", subtitle "Escaneie, personalize e envie sua criação pelo WhatsApp."; prepared only after the owner approves that address.
- **Runbook:** `docs/08-deployment.md`, with each product-owner step marked and the deployment log.
- **Status:** Approved (product owner, 2026-11-09). Repository prepared; no Cloudflare resource created and nothing deployed.

### D-078 — Three groups at the end: review, note, finalization (2026-11-09)

- **Context:** mobile usability feedback: the review held the summary, the reset, the status, the disclaimer, the note, the blockers, and the actions in one long panel, and the missing choices were listed twice (the status line and the export reasons).
- **Decision (approved by the product owner, 2026-11-09):** the lower page has three separate groups, each a step panel. (1) "Revisar personalização": the summary and "Reiniciar configurações" only, ending with the reset. (2) "Observação": the optional note (D-062), its hint, and its field; a collapsible step on phones, closed at first, state "Opcional", the first line of the note as its summary; the text is kept while closed (the step stays mounted). (3) "Finalizar personalização": always open, with a plain heading, so the actions are always at hand; the approved disclaimer (D-056, unchanged), then the status, then "Compartilhar personalização", "Baixar imagem", and the WhatsApp fallback (D-076).
- **One status location:** "Situação da configuração" in "Finalizar" lists what blocks the actions: the missing choices in one "Falta escolher: …" line, then each invalid choice and preview problem (D-063); "Configuração completa." when nothing does. The former separate status line (`ConfigurationStatus`) is removed, so no blocker is shown twice; invalid choices are still explained at their field (D-029).
- **Preparing the PNG to share:** D-076 prepared it only while the review was open on phones. "Finalizar" is now always open, so on phones the PNG is prepared while no step that changes the image (model, text, position) is open: not while typing. Wide screens are unchanged (always). A note edit still never re-renders the PNG.
- **Unchanged:** catalog, calibration, typography, text positioning and highlighting, rendering and watermark, PNG export, Native Share, the order message, and every validation rule.
- **Status:** Approved (product owner, 2026-11-09). Implementation pending acceptance.

## Proposed

### D-066 — Lettering font evaluation: Georgia Bold and Century Gothic Bold (2026-11-08)

- **Scope:** evaluation only (product owner request 9). The production lettering fonts are unchanged until a visual comparison is approved.
- **Reference:** the real lettered pieces (`docs/reference-images/um-passo-de-cada-vez-…`, `quadro-rastico-a-luz-dourada-…`, `travessa-artesanal-da-prosperidade-…`) use one style: uppercase, geometric, monoline, round "O", generous letter spacing, rounded stroke ends. No reference shows serif lettering.
- **Measured** (canvas, Chromium and WebKit on macOS, identical to 0.1 px), capital height ÷ font size and the width of "TRANSBORDA." at the Placa's 53.568 px (area 454.4 px wide): current "Sem serifa" `system-ui` 400: 0.7046, 354.5 px; current "Com serifa" Georgia 400: 0.6929, 380.7 px; **Georgia Bold 700: 0.6929, 429.7 px** (+13% vs Georgia 400, +21% vs the current sans); `system-ui` 700: 0.7046, 373.9 px. **Century Gothic is not installed on the test machine**: the browser fell back to another face, so no Century Gothic metrics could be measured.
- **Availability:** Georgia (Microsoft core font) ships with macOS, iOS, and Windows, but not with Android or most Linux, where the serif option would fall back to another face (e.g. Noto Serif) with different widths. Century Gothic (Monotype) ships with Microsoft Office, not with macOS, iOS, or Android: most customers' browsers do not have it. The current `system-ui` stack is also platform dependent (San Francisco, Segoe UI, Roboto), so even today line wrapping and overflow can differ between an iPhone and an Android phone.
- **Licensing:** neither Georgia nor Century Gothic may be bundled as a web font without a license: Georgia's redistribution is limited to Microsoft's original packages, and Century Gothic needs a paid Monotype web-font license. Bundling either requires written authorization. Openly licensed alternatives that may be self-hosted (embedding and redistribution allowed): TeX Gyre Adventor (GUST Font License; a Bold; the URW Gothic / ITC Avant Garde Gothic design family that Century Gothic follows), and Google Fonts faces under the SIL OFL such as Poppins (700) or Didact Gothic (regular only). For a serif: Libre Baskerville or Gelasio (OFL, Bold; Gelasio is metric-compatible with Georgia).
- **Calibration:** the physical 7 mm capital (D-055) is kept by deriving each model's font size from the chosen font's capital ratio: `fontSize = 7 mm × scale ÷ capRatio`. Georgia's 0.6929 equals today's serif, so its capitals stay ~6.9 mm; a sans with a different ratio needs the formula's divisor updated, not new physical sizes. Wider bold letters reduce how much fits on a line, which the shared layout already reports (wrapping, `text-overflow`, the D-063 line limit); the existing overflow tests then need their expectations rechecked per font.
- **Recommendation:** for "Sem serifa", a self-hosted, openly licensed geometric Bold (TeX Gyre Adventor Bold first, for its closeness to Century Gothic and to the real lettering) gives identical rendering in Chrome and Safari on every device, and in the preview and PNG (both use the same canvas and font). Do not rely on an installed Century Gothic. For "Com serifa", Georgia Bold is only predictable on Apple and Windows; if the serif option stays, a self-hosted OFL serif Bold (e.g. Gelasio Bold) is the predictable choice. Red Hat Display stays for the interface only. Next step, once approved: a comparison sheet of the self-hosted candidates on the four product photographs against the reference pieces.
- **Status:** Resolved by D-072 (Quicksand Bold and Gelasio Regular, self-hosted).

### D-007 — SVG preview rendering

- **Status:** Superseded by D-035 (Canvas 2D).

## Pending

- **P-01:** Resolved (product owner, 2026-11-08): Placa cerâmica 100 × 100 mm; Quadro 200 × 200 mm outside, holding a 100 × 100 mm ceramic plate; Bandeja ondulada M 80 × 80 mm; Bandeja ondulada G 110 × 110 mm. Recorded as `dimensions` (outer size; the Quadro's ceramic is noted in the catalog comments and D-055). The Bandeja labels changed from "Aprox. 8 cm" / "Aprox. 11 cm" to the nominal "8 × 8 cm" / "11 × 11 cm" (D-054); the handmade-variation disclaimer stays.
- **P-02:** Resolved: the palette was revised and extended by D-067 (Marrom `#802b00`, Azul `#002b80`, Verde `#006600`, Vermelho escuro `#7a1f1f`, Laranja escuro `#b25900`, Amarelo queimado `#b38f00`, Preto `#000000`). First resolved by D-056: Marrom `#4a2a14`, Azul `#2b4a7a`, Verde `#2f4a36`, Vermelho escuro `#7a1f1f`, in that order, each also usable as the second color. Still open: Amarelo queimado (proposed `#a87a10`, pending visual approval) and Laranja (excluded for now, reversible). Earlier history: the names came from D-049, and the empty production palette was why the site showed "As cores do texto ainda não foram definidas." (a data dependency, not a rendering defect).
- **P-03:** Resolved by D-046: no separate frames; the Quadro is photographed assembled.
- **P-04:** Production typography rules and text limits (max length, lines).
- **P-05:** Export resolution, transparency, background, file naming.
- **P-06:** Resolved: one photograph per model (D-041) is registered, the Quadro assembled with its frame (D-046), the Bandejas sharing one (D-054).
- **P-07:** Resolved: object bounds, text areas (inside the ceramic for the Quadro, on the flat floor for the Bandejas), and fixed lettering sizes from the real dimensions are calibrated for all four models (D-053, D-054, D-055).
- **P-08:** Source image format, resolution, and consistency requirements (framing, lighting, background). Conventions and recommendations: `docs/07-product-assets.md`.
- **P-09:** Resolved by D-046: no frame choice, so no frame finish variations.
- **P-10:** Partly resolved by D-048: usage rights confirmed. Still pending: the original file name or location of each catalog photograph, for provenance records.
- **P-11:** Resolved by D-040: the scalloped dishes are the Bandeja ondulada M models. No circular model is registered.
- **P-12:** Resolved (product owner, 2026-11-08): the four permanent model IDs are `placa-ceramica-10` (D-051), `quadro-20`, `bandeja-ondulada-m-8`, and `bandeja-ondulada-g-11`.
- **P-13:** Resolved by D-046: no model takes an optional frame.
- **P-15:** Resolved (2026-11-08): with the confirmed dimensions (P-01), the Quadro (0.0424), Bandeja ondulada M (0.1170, now 0.0805 by D-074), and Bandeja ondulada G (0.0851, now 0.053 by D-073) have fixed lettering sizes (D-055). The 7 mm letter height stays a provisional estimate; a measured letter height of TAAVI's molds would replace it.
- **P-14:** Typefaces resolved by D-072. Still open: the per-line text-length limit.
- **P-16:** TAAVI's official WhatsApp number (international form, digits only), for "Abrir WhatsApp da TAAVI" (D-076). Until supplied, the link is not offered; sharing and download work without it.
