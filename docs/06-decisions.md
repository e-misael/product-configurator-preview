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
- **Update (D-050):** The preview is illustrative, not a photorealistic guarantee. Real Taavi photographs are still required and preferred over synthetic images; AI-assisted removal of existing lettering from Taavi's own photographs is acceptable. The no-tint and no-invented-product rules are unchanged.
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
- **Decision:** `AssetRef.src` must match `/catalog/{plates|frames|colors}/{owner-id}/{name}.{webp|png|jpg}` with kebab-case segments, where `owner-id` is the ID of the component that references it. The check is an allowlist at runtime (`isValidAssetPath`, `invalid-asset`), so external URLs, other schemes (`data:`, `javascript:`), traversal, query strings, and encoded characters are rejected; TypeScript types are not relied on. Assets are same-origin files under `public/catalog/` so a future canvas export is not tainted. File existence is verified by a test that lists `public/catalog/` at test time; there is no runtime fetch. Optional `widthPx`/`heightPx` are declared together as positive integers; M1.3b adds a check that they match the files. Originals stay outside the repository in Taavi's source archive (P-10). Guide: `docs/07-product-assets.md`.
- **Alternatives:** Free-form paths checked only for non-blank (previous rule; too permissive); external hosting (out of scope).
- **Update (M4.1a):** The `colors` owner folder no longer exists; paths are `/catalog/{plates|frames}/{owner-id}/…` (D-041).
- **Update (M4.2):** The `frames` owner folder no longer exists; paths are `/catalog/plates/{owner-id}/…` (D-046).
- **Update (2026-11-08):** Selected reference photographs that Taavi has the rights to may be versioned in `docs/reference-images/` as documentation (never served or registered); temporary working files and unrelated originals stay outside the repository.
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
- **Decision:** `scripts/generate-demo-assets.js` (`npm run generate:demo-assets`) writes deterministic synthetic PNGs to `src/demo/public/catalog/…`; the output is committed. They are deliberately not photograph-like: flat fills, hatched borders, an outlined text area, a "DEMO" stamp, and an embedded PNG comment "Synthetic demonstration image - not a Taavi product photograph". They cover two square models and two scalloped trays (one image each), and two frames with back and front layers; the production catalog has no images, which exercises the pending state. Vite copies its public directory into every build, so `vite.config.ts` sets `publicDir` to `src/demo/public` only in demo mode and to the (currently absent) `public/` otherwise; demo files are never in the production public directory. Isolation is checked three ways: `scripts/check-demo-isolation.js` scans file contents and file names of `dist/` for demo markers (including the PNG comment); a unit test asserts `public/` has no `demo-` files; Playwright asserts the production build requests and serves no demo image. Tests verify the demo catalog's declared pixel sizes match the PNG headers, that no file is orphaned, and that every described image is labeled as a demonstration.
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

- **Context:** Taavi supplied the products currently sold: Placa cerâmica (10 cm x 10 cm), Quadro (20 cm x 20 cm), and two Bandeja ondulada M (~ 8 cm and ~ 11 cm). The earlier "Placa" and "Quadro" wording no longer fits: Quadro is now a product.
- **Decision:** The customer chooses a **Modelo** (code type `Plate`); the optional frame is **Moldura** (`Frame`). The four models are registered in the production catalog with the supplied names and size labels, which are shown as `displayName (sizeLabel)` and kept as supplied, approximations included. The Quadro (20 cm x 20 cm) is a separate model, not a frame. `PlateShape` gains `scalloped` for the two wavy trays as a classification only: no geometry is inferred and no frame rule depends on it. Physical dimensions stay `pending` (`sizeLabel` is display text). Every model is `supportsFrame: false` because no model is confirmed to take an optional frame; the production catalog has no frames. Provisional IDs (`placa-ceramica-10`, `quadro-20`, `bandeja-ondulada-m-8`, `bandeja-ondulada-m-11`) become permanent once Taavi confirms them (P-12). The shape is no longer shown in the UI.
- **Alternatives:** Keeping "Placa" as the generic word (ambiguous with the Placa cerâmica model); inferring shapes for the trays (rejected: invented data).
- **Update (M4.2):** Superseded in part by D-046: there is no "Moldura" choice; the labels are now "Placa cerâmica — 10 × 10 cm", "Quadro — 20 × 20 cm", "Bandeja ondulada M — Aprox. 8 cm", and "Bandeja ondulada G — Aprox. 11 cm", shown as `displayName — sizeLabel`; and `bandeja-ondulada-m-11` was renamed `bandeja-ondulada-g-11`.
- **Status:** Approved (IDs pending confirmation; amended by D-046).
- **Date:** 2026-11-08.

### D-041 — Fixed ceramic color owned by the catalog; one image per model

- **Context:** Taavi's pieces are all beige ("Bege"); the customer does not choose the ceramic color. Supersedes D-012 (color) and D-032.
- **Decision:** Color categories, specific colors, and the color selection are removed. `Plate.ceramicColor` holds the fixed color as supplied ("Bege") and is shown read-only as "Cor da peça". Configuration validation has no color rule. `Plate.image` is the model's single photograph (optional while pending); the former per-variation images, swatches, `colors` collection, and `/catalog/colors/` asset folder are gone. Integrity adds `empty-label` for blank `sizeLabel`/`ceramicColor`. No customer configuration is persisted, so no data migration is needed; a demo session simply restarts. Preview and export keep the real-image rule (D-027): the photograph is never tinted.
- **Status:** Approved.
- **Date:** 2026-11-08.

### D-042 — Advanced text customization design (planned, M4.1b)

- **Context:** The product needs font family, up to two lettering colors, and text positioning.
- **Decision (design only, not implemented):** (1) `fontFamily` is `serif` or `sans-serif` ("Com serifa" / "Sem serifa", default sans-serif), mapped to provisional system font stacks; real typography stays pending (P-04). (2) `textColorId` is required (no default) and `secondaryColorId` is optional with `secondaryRanges` as UTF-16 offsets snapped to grapheme boundaries; the lettering palette is catalog data (P-02). (3) One source of truth for position: nine presets (left/center/right × top/middle/bottom) plus a normalized manual position inside the calibrated text area; dragging keeps the line alignment; "Redefinir posição" restores the catalog default; the position survives model changes constrained to the new safe area. (4) Touch movement requires an explicit "Mover texto" mode so scrolling is not hijacked; keyboard positioning is supported. (5) Editing text keeps secondary ranges when they map unambiguously and removes or invalidates them otherwise; grapheme clusters are never split. (6) The handmade disclaimer is shown near the controls: "Todas as solicitações de personalização estão sujeitas à análise da Taavi. Como nossas peças são produzidas artesanalmente, podem apresentar pequenas variações de formato, cor, acabamento e posicionamento em relação à pré-visualização." (7) A per-line text-length limit is a future rule, recorded in the backlog and not implemented.
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
- **Decision:** Product photographs and visual assets are prepared and registered only by Taavi in the version-controlled catalog. Customers cannot upload images (no file picker, drag-and-drop, paste, or image URL), and there is no customer image storage or upload API. Images are same-origin catalog assets only (D-031). Recorded as FR-09.
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

- **Context:** Taavi answered part of the M1.3b-1 input list. These are product facts supplied by the store, recorded verbatim; nothing is derived from them.
- **Confirmed:** (1) Taavi has permission to use its product photographs. (2) The official product name is "Placa cerâmica (tamanho 10 x 10 cm)", verbatim (with "x", not "×"). (3) ~~The available lettering colors for now are Preto, Marrom, Azul, Verde~~ — superseded by D-049. (4) Lettering may be applied across the ceramic surface, never on the wooden frame.
- **Rules that follow:** No hex value is assigned to any lettering color until Taavi supplies or approves one, so `Catalog.textColors` stays empty (P-02). The Quadro's text area is restricted to the ceramic part of its assembled photograph (consistent with D-046). The Placa's text area is set only after inspecting the actual catalog photograph; curved or rounded edges, bevels, and physical margins are not assumed printable. Reference photographs already shared are not catalog assets until inspected and approved (`docs/07-product-assets.md`).
- **Not yet applied:** the catalog still shows "Placa cerâmica — 10 × 10 cm" (D-046). Resolved by D-051: the customer-facing label stays "Placa cerâmica — 10 × 10 cm".
- **Status:** Approved (facts confirmed by Taavi); recorded only, not implemented.
- **Date:** 2026-11-08.

### D-049 — Revised lettering-color names (2026-11-08)

- **Context:** Taavi replaced the palette confirmed in D-048 (3).
- **Decision:** The approved lettering-color names are **Marrom, Azul, Verde, Amarelo, Laranja, Vermelho escuro**, in the order supplied. Preto is no longer approved and is not registered unless Taavi approves it again.
- **Rules that follow:** Names only. No `#rrggbb` value is invented or approved automatically; any proposed digital value is reviewed and approved by Taavi before it becomes a production color. `Catalog.textColors` stays empty until then (P-02).
- **Status:** Approved (names confirmed by Taavi). Values and the first production palette in D-056: Amarelo became "Amarelo queimado" (pending), Laranja is excluded for now.
- **Date:** 2026-11-08.

### D-050 — Preview fidelity: illustrative, from Taavi's own photographs (2026-11-08)

- **Context:** The product owner clarified that the preview illustrates the personalized piece; it is not a photorealistic guarantee of a handmade product. D-027's "visual accuracy" rationale was being read as pixel fidelity to the original photograph.
- **Decision:** (1) Real Taavi product photographs are preferred over synthetic images. (2) AI-assisted removal of existing lettering is acceptable when preparing Taavi's own photographs. (3) Minor differences in ceramic texture, lighting, color, shape, and finish are acceptable; an image is rejected only when artifacts materially harm its appearance or misrepresent the product. (4) Pixel-level fidelity to the original photograph is not required. (5) Priorities are useful and attractive previews, correct text placement, readable lettering colors, and reliable PNG export. (6) The disclaimer that personalization requests are subject to Taavi's review and that handmade pieces may vary from the preview stays in the interface.
- **Unchanged:** no CSS tinting or recoloring of photographs to fake a ceramic color; no generated or substituted product images; no customer image uploads; no invented product data, including lettering-color values (D-049).
- **Applied:** `plate-no-text.png` (lettering removed from Taavi's "Um passo de cada vez" photograph) is accepted as the candidate catalog image for the Placa cerâmica after a basic visual quality check (`docs/07-product-assets.md`).
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
- **Status:** Architecture approved (2026-11-08) and implemented; half strength is technically accepted (D-053), but the look is not approved until the flat-versus-debossed comparison is reviewed. Pixel tests guard the technique, not the look.
- **Performance:** Under 4× CPU throttling a debossed redraw takes about 25 ms (about 40 fps while dragging) against 60 fps flat. No optimization is made without evidence from real devices.
- **Date:** 2026-11-08.

### D-053 — Placa photograph and calibration approved (2026-11-08)

- **Decision:** Approved by the product owner for the first production iteration, after reviewing the rendered crop, overlay, and colors: (1) the 640 × 640 crop of `plate-no-text.png`; (2) `objectBounds` `{ x: 0.0781, y: 0.0891, width: 0.8422, height: 0.8219 }`; (3) `text.area` `{ x: 0.145, y: 0.155, width: 0.71, height: 0.69 }`; (4) centered default alignment and placement; (5) the photographic presentation as is, with no background removal or tinting.
- **Color review (not a production approval):** Marrom `#4a2a14`, Azul `#2b4a7a`, Verde `#2f4a36`, and Vermelho escuro `#7a1f1f` are visually acceptable. Amarelo `#e0b225` and Laranja `#e07a1f` stay proposals with a legibility concern; they are not removed or darkened automatically. All six stay in demonstration data until Taavi approves production values (P-02).
- **Deboss (D-052):** half strength is technically accepted; its look is not yet approved.
- **Status:** Approved (product owner, 2026-11-08).
- **Date:** 2026-11-08.

### D-054 — Confirmed product facts for M1.3b-2 (2026-11-08)

- **Decision:** Supplied by the product owner: (1) the Bandeja ondulada M and G share one design, so both use the same photograph and placement, stored once per model folder as identical files (assets stay in their own model's folder); (2) the Quadro and Bandeja photographs (`quadro-no-text.jpg`, `ondulada.jpg`) are Taavi's own, with the lettering removed by AI editing, which D-050 accepts; (3) both the Quadro and the Bandejas take colored lettering, like the Placa; (4) the processed catalog files are JPEG at quality about 90.
- **Not decided here:** crops, `objectBounds`, and `text.area` for these photographs stay proposals until the visual review approves them; IDs stay as in P-12; color values stay pending (P-02).
- **Calibration (M1.3b-2, product owner review 2026-11-08):** Quadro: 660 × 660 crop at x 427, y 156 of `quadro-no-text.jpg`; `objectBounds` (the whole framed product) `{ x: 0.0364, y: 0.0318, width: 0.9273, height: 0.9364 }`; `text.area` on the ceramic only, about 8% inside its edge, `{ x: 0.3009, y: 0.3494, width: 0.3589, height: 0.3589 }`. Bandejas: 1060 × 1060 crop at x 54, y 171 of `ondulada.jpg`; `objectBounds` `{ x: 0.0283, y: 0.0387, width: 0.9425, height: 0.9226 }`; `text.area` `{ x: 0.28, y: 0.265, width: 0.43, height: 0.43 }`, on the flat floor with a margin of about 0.01 from the wavy walls. All centered. The owner asked for a wider, shorter floor rectangle to be compared with the square; the widest one clear of the walls (`0.585 × 0.31`) fits one line fewer (M 2 lines instead of 3, G 3 instead of 4) for 2–3 more characters per line, so the square was kept as the meaningful-improvement test failed. The first proposed square (`0.2726, 0.2736, 0.4528`) touched the wall foot at its lower-right corner and was corrected.
- **Approval:** crops, bounds, centered placement, and the square text-area rule approved; the corrected square was chosen under the owner's rule "keep the square if the difference is negligible". M1.3b-2 accepted by the product owner (2026-11-08), with the permanent IDs (P-12) and the nominal Bandeja labels "8 × 8 cm" and "11 × 11 cm".
- **Status:** Approved (product owner, 2026-11-08).
- **Date:** 2026-11-08.

### D-055 — Fixed lettering size (2026-11-08)

- **Context:** Taavi letters the pieces with physical molds of one size, so text that grows or shrinks with its length misrepresents the product.
- **Decision:** Each model's text placement carries a fixed `fontSize` as a fraction of its photograph's width (`TextLayout.fontSize`, per model, not per photograph: models sharing a photograph can differ in physical size). The size never depends on the text, its wrapping or line breaks, the alignment, or the position; text is never shrunk, enlarged, clipped, or truncated. Text taller or wider than the area is drawn at the same size with the `text-overflow` warning ("O texto não cabe na área do modelo. Reduza o texto ou use menos linhas."), and export is blocked. There is no customer size control.
- **Placa value:** 0.0837 of the image width (53.6 px on the 640 px photograph), for a visible capital about **7 mm** tall on the 100 mm plate. The 7 mm is a provisional estimate (6–8 mm) by the product owner from the reference photograph of a real lettered 10 × 10 cm Placa, `docs/reference-images/um-passo-de-cada-vez-…webp`. It is not a verified mold or manufacturing measurement; a direct reading of that photograph gives about 6.4 mm (6.2–6.6).
- **Glyph height vs font size:** the canvas sets a nominal font size; the visible capital is 0.705 of it for the sans-serif stack and 0.693 for serif (measured in Chromium and WebKit on macOS; other platforms' system fonts differ by a few percent). Formula: `fontSize = capMm × (objectBounds.width ÷ ceramicWidthMm) ÷ 0.705`, so 7 × (0.8422 ÷ 100) ÷ 0.705 = 0.0837. At this size serif capitals are about 6.9 mm. The previous value, 0.08625 (55.2 px, half the former starting size), gave about 7.2 mm.
- **Pending state:** `fontSize` is optional, so a model without an approved size keeps the catalog valid. When such a model has text, nothing is drawn on the image, the `text-size-pending` notice says so ("O tamanho das letras deste modelo ainda não foi definido; o texto não aparece na imagem."), and export is blocked like any preview notice. There is no fallback to fitting and no guessed size. Validation rejects a `fontSize` that is not a finite number in (0, 1].
- **Other models (approved 2026-11-08 with the confirmed dimensions, P-01):** Quadro 0.0424 (the 100 mm ceramic, 282 of 660 px, never the 200 mm frame; 28.0 px); Bandeja ondulada M 0.1170 (80 mm, 0.9425 of 1060 px; 124.0 px); Bandeja ondulada G 0.0851 (110 mm, same photograph; 90.2 px). M and G share a photograph but not a size. Same formula, with the measured cap ratio 0.7046 (0.705 rounded). The bandeja's dish measures 999 × 978 px in the photograph; its width is used, as for the Placa. Demo models use the same rule on their synthetic areas (demo-only values).
- **Alternatives:** Halving the fitted size (rejected: still resizes with the text); a size per photograph (rejected: Bandeja M and G share one photograph at different physical sizes).
- **Status:** Approved (product owner, 2026-11-08): Placa, then Quadro and Bandejas M and G.
- **Date:** 2026-11-08.

### D-056 — First production lettering palette and disclaimer (2026-11-08)

- **Decision:** The production catalog lists four lettering colors, in this order: Marrom `#4a2a14` (`marrom`), Azul `#2b4a7a` (`azul`), Verde `#2f4a36` (`verde`), Vermelho escuro `#7a1f1f` (`vermelho-escuro`). Every available color may also be the second color; the second must differ from the first (existing `same-as-primary` rule). The primary color stays required, with no default.
- **Pending and excluded:** Amarelo queimado (replacing Amarelo, D-049), proposed `#a87a10`, ID `amarelo-queimado`, awaits visual approval and is not in the production catalog. Laranja is excluded from the initial palette; reversible. The demo catalog is unchanged (its "(proposta)" entries, Amarelo and Laranja included, stay demo-only).
- **Legibility (measured against the median face color of each text area):** Marrom 4.8 / 6.9 / 7.0 : 1 on the Placa / Quadro / Bandeja; Azul 3.3 / 4.8 / 4.8; Verde 3.6 / 5.2 / 5.3; Vermelho escuro 3.8 / 5.5 / 5.6. Amarelo queimado would measure 1.4 / 2.1 / 2.1 (the earlier Amarelo 1.3 / 1.1 / 1.1, Laranja 1.1 / 1.6 / 1.6).
- **Disclaimer (replaces the copy of D-042):** three paragraphs below the controls: "A pré-visualização é ilustrativa. Como nossas peças são produzidas artesanalmente, o produto final pode apresentar pequenas variações de formato, textura, acabamento, posicionamento das letras e tonalidade das cores em relação à imagem exibida na tela." / "As cores também podem variar conforme a iluminação, as características da cerâmica e as configurações de cada dispositivo." / "Todas as solicitações de personalização estão sujeitas à análise e aprovação da Taavi."
- **Consequence:** production configurations can be completed and exported as PNG for the first time.
- **Status:** Approved (product owner, 2026-11-08).
- **Date:** 2026-11-08.

### D-057 — Pre-beta UX refinement: Bandeja sizes, position section, overflow presentation (2026-11-08)

- **Bandeja sizes:** Bandeja ondulada M and G are shown as one option, "Bandeja ondulada" ("Disponível em dois tamanhos"), with a required "Tamanho" choice: "M — 8 × 8 cm" and "G — 11 × 11 cm" (letter plus the supplied size label). No size is preselected. This is a presentation table (`src/components/configurator/model-groups.ts`, keyed by the real IDs); each size stays its own catalog model, and the configuration stores only its ID, so validation, preview, export, and the file name (`taavi-bandeja-ondulada-g-11.png`) are unchanged. Choosing the group clears `plateId`; while no size is chosen the missing field is called "Tamanho" and the preview asks for it. Changing the size changes only `plateId`. The summary shows "Modelo" and "Tamanho" as separate rows for every model. The table belongs with its catalog and is passed to `App` (`modelGroups`): production uses `MODEL_GROUPS`; demo mode passes `demoModelGroups` from `src/demo/demo-catalog.ts` ("(demonstração) Bandeja ondulada" over `demo-bandeja-ondulada-m-8` / `-g-11`), so both run the same grouping code and production code never names a demo ID (D-028).
- **Position section:** one "Posição do texto" section without the visible captions "Posições predefinidas" and "Ajuste fino" (kept as accessible group names); a compact arrow pad beside the nine presets (36 px buttons, 44 px on coarse pointers); one status line announces the position ("Posição: Centro." or "Posição personalizada: horizontal 34%, vertical 50%.", "sem espaço livre" for an axis without free space). Replaces the separate "Posição personalizada." and "Horizontal X%, vertical Y%." lines of D-044/FR-05.15.
- **Overflow presentation:** detection, the fixed size (D-055), the layout, and export blocking are unchanged; all text stays drawn, never clipped, truncated, or resized. While the text overflows, the preview draws a dashed outline (dark dashes over a light halo) of the calibrated text area on top of the image; it is painted by the preview canvas after `drawScene`, never by `drawScene`, so no export contains it. For vertical overflow the message states the lines over the area's capacity (`floor(area height ÷ line height)`): "O texto não cabe na área do modelo: 1 linha a mais. Reduza o texto ou use menos linhas." ("2 linhas a mais", …). Horizontal-only overflow keeps the general message.
- **Status:** Approved (product owner, 2026-11-08).
- **Date:** 2026-11-08.

## Proposed

### D-007 — SVG preview rendering

- **Status:** Superseded by D-035 (Canvas 2D).

## Pending

- **P-01:** Resolved (product owner, 2026-11-08): Placa cerâmica 100 × 100 mm; Quadro 200 × 200 mm outside, holding a 100 × 100 mm ceramic plate; Bandeja ondulada M 80 × 80 mm; Bandeja ondulada G 110 × 110 mm. Recorded as `dimensions` (outer size; the Quadro's ceramic is noted in the catalog comments and D-055). The Bandeja labels changed from "Aprox. 8 cm" / "Aprox. 11 cm" to the nominal "8 × 8 cm" / "11 × 11 cm" (D-054); the handmade-variation disclaimer stays.
- **P-02:** Resolved for the first production palette by D-056: Marrom `#4a2a14`, Azul `#2b4a7a`, Verde `#2f4a36`, Vermelho escuro `#7a1f1f`, in that order, each also usable as the second color. Still open: Amarelo queimado (proposed `#a87a10`, pending visual approval) and Laranja (excluded for now, reversible). Earlier history: the names came from D-049, and the empty production palette was why the site showed "As cores do texto ainda não foram definidas." (a data dependency, not a rendering defect).
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
- **P-15:** Resolved (2026-11-08): with the confirmed dimensions (P-01), the Quadro (0.0424), Bandeja ondulada M (0.1170), and Bandeja ondulada G (0.0851) have fixed lettering sizes (D-055). The 7 mm letter height stays a provisional estimate; a measured letter height of Taavi's molds would replace it.
- **P-14:** Real serif and sans-serif typefaces for the text (system stacks are provisional) and the per-line text-length limit.
