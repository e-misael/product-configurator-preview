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

Status: **In progress** — implemented; pending owner review. The frame capability and frame selection rules below were removed in M4.2 (D-046).

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

Status: **Partly done**: the four supplied models are registered without images or measurements (M4.1a, D-040). The rest is **blocked on clean photographs and measurements from the store.**

- Confirm the four provisional model IDs (P-12). No model takes a separate frame (P-13 resolved by D-046); the Quadro is photographed assembled.
- Processed images under `public/catalog/` (background removal/masking, perspective correction as needed); originals archived outside the repository with provenance.
- Declared intrinsic sizes plus a check that they match the files.
- Calibrated `objectBounds` and text areas (for the Quadro, inside the ceramic); visual verification against the originals.
- Checklist: [07-product-assets.md](07-product-assets.md#m13b-checklist).

### M1.3b-1 — First real product (vertical slice)

Status: **Done** (technical implementation, committed in 6d8cbb2, 2026-11-08). Crop, calibration, centered default, and photo presentation approved (D-053). Delivered: the Placa photograph (640 × 640 crop) in `public/catalog/plates/placa-ceramica-10/bege.png` with its calibration in the production catalog; debossed lettering (D-052) in the shared Canvas renderer, so preview and PNG export match; the six proposed colors in the demo catalog only. Production still has no lettering colors, so production export stays blocked. Checks: 446 unit tests; Playwright 91 passed, 3 skipped, including Chromium and WebKit pixel tests (no pixel outside the glyphs changes; stroke centers keep their color) and a throttled drag test. Production-readiness dependencies (tracked here, not reopening M1.3b-1):

- Lettering palette (P-02): Taavi's production `#rrggbb` values. Marrom, Azul, Verde, and Vermelho escuro are visually acceptable to the product owner; Amarelo and Laranja remain proposals with a legibility concern. Until then production export stays blocked.
- Typography (P-04, P-14): real typefaces and text limits; system font stacks are provisional.
- Deboss look (D-052): aesthetic approval; half strength is technically accepted only.
- Mobile rendering: about 40 fps while dragging under 4× CPU throttling; optimize only with evidence from real devices.

History: inputs confirmed so far (D-048): photo usage rights, the official name "Placa cerâmica (tamanho 10 x 10 cm)", the color names Marrom, Azul, Verde, Amarelo, Laranja, Vermelho escuro (D-049), and the text-area rule (ceramic only, never the frame). Candidate photograph `plate-no-text.png` accepted under D-050 after a basic quality check; crop and calibration proposed and a color review sheet prepared (`docs/07-product-assets.md`). ID, label, and centered default placement approved (D-051). Crop, calibration, and centered alignment provisionally accepted for the first iteration; the six proposed `#rrggbb` values are for review and demo only. Implementation approved on 2026-11-08 with the inner-shadow conditions of D-052.

## M2 — Configuration interface

Status: Done (validated against the demo catalog; production catalog still empty). The color controls and the "Placa"/"Quadro" wording below were superseded by M4.1a (D-040, D-041).

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

### M3.1 — Interactive photographic preview

Status: **Done** (accepted 2026-11-07) for the demo catalog — verified with synthetic images only. Real product photographs and calibration are M1.3b.

- [x] Canvas 2D as the single renderer (D-035)
- [x] Pure `composePreview` (exact image lookup, notices) and `buildScene` (placement from normalized metadata, layer order) (D-037)
- [x] Layer order frame back → plate → text → frame front; plate fitted into the frame placement preserving aspect ratio
- [x] Distinct states: not selected, color missing/invalid, image pending in catalog, loading, load failure, frame problems, text area pending, text overflow
- [x] Frame without calibration, or with a failed file, is not drawn; the plate is shown alone
- [x] Text: raw text, explicit line breaks, grapheme-safe wrapping, bounded shrink, visible overflow warning (D-038)
- [x] Responsive canvas; backing store from displayed width, device pixel ratio, and source resolution
- [x] Synthetic PNGs generated deterministically, served only in demo mode; isolation verified for JavaScript, file names, and image assets (D-036)
- [x] Unit, component, and Playwright (pixel) tests

### M3.2 — Remaining preview work

Status: Planned (not started).

- Real images and calibrated placement (after M1.3b); visual verification against the real photographs.
- Masking/clipping of circular or irregular outlines (a bounding box does not describe them).
- Typography and material effect of the lettering (stamped/pressed/raised; P-04).
- Preview regression tests with real assets.

## M4.1 — Product models and advanced text

Split into independently testable slices (D-039); M4.1b is further split into M4.1b-1 and M4.1b-2 (D-043, D-044). No slice is started automatically.

### M4.1a — Product models and fixed properties

Status: **Done** (accepted 2026-11-08). Evidence: typecheck, lint, format check, 340 unit tests, build, demo isolation check, demo build with markers present, and 50 Playwright tests passed.

- [x] UI vocabulary: "Modelo" for the product (`Plate`), "Moldura" for the optional frame; "Quadro (20 cm x 20 cm)" is a separate model (D-040)
- [x] Four production models registered with the supplied names and size labels (approximations kept); provisional IDs; physical dimensions `pending`; no images, no frames (D-040)
- [x] `scalloped` shape as classification only (D-040)
- [x] Customer-selectable ceramic color removed; fixed `ceramicColor` ("Bege") owned by the catalog and shown read-only as "Cor da peça" (D-041)
- [x] One image per model (`Plate.image`); `colors` collection, color rules, and `/catalog/colors/` removed; `empty-label` integrity check (D-041)
- [x] The frame field is hidden when the model takes no frame; frame clearing and kept-invalid behavior unchanged (D-026, D-030)
- [x] Demo catalog mirrors the four models with synthetic images; `demo-quadro` is frame-capable only in the demo
- [x] Unit, component, and Playwright tests updated; production smoke lists the four models with the photo pending

### M4.1b-1 — Typography, lettering colors, styled ranges, disclaimer

Status: **Done** (accepted 2026-11-08, D-043). Evidence: typecheck, lint, format check, 442 unit tests, production build, demo isolation check, demo build with markers present, and 60 Playwright tests passed.

- [x] Font family "Sem serifa" (default) / "Com serifa", provisional system font stacks (P-14)
- [x] `Catalog.textColors` (`TextColor`: `id`, `displayName`, `hex`); integrity checks `empty-label`, `invalid-color`; IDs unique across all collections. Production palette empty (P-02); three labeled synthetic demo colors (`demo-letra-*`, isolation marker added)
- [x] Required `textColorId` (no default); optional `secondaryColorId` (not equal to the primary) with `secondaryRanges`
- [x] Selection + "Aplicar segunda cor à seleção" / "Remover segunda cor da seleção"; grapheme-safe ranges; deterministic caret-aware remap on edit, ambiguous edits remove the affected formatting with a notice
- [x] Last range removed → second color kept; "Sem segunda cor" clears color and ranges
- [x] Scene text block carries per-line colored segments from source offsets (soft wraps included); canvas draws mixed-color lines as consecutive runs; overflow warnings unchanged
- [x] Provisional preview color identified as such: preview notice "Cor do texto ainda não escolhida…" and summary "Não escolhida"
- [x] Handmade-product disclaimer (copy in D-042)
- [x] Unit, component, and Playwright tests (lettering color and font pixels, second color on a keyboard selection, production palette message)

### M4.1b-2 — Text alignment and manual positioning

Status: **Done** (accepted 2026-11-08, D-044). Evidence: typecheck, lint, format check, 491 unit tests, production build, demo isolation check, demo build with markers present, and 73 Playwright tests passed (2 intentionally skipped per device).

- [x] `Configuration.textLayout: TextPlacement | null` (`{ align, x, y }`, free-space fractions); `invalid-layout` validation; `null` = catalog default, which draws exactly what earlier versions drew
- [x] Nine presets set alignment, x, and y together; "Alinhamento das linhas" changes only the alignment
- [x] Scene text block carries measured line widths, free space, and block bounds; `fitText` unchanged (no enlarging; size independent of position)
- [x] Mouse/pen drag on the canvas with hit testing in scene units (works at any displayed size and pixel density); dragging changes only the position
- [x] Touch drag only in "Mover texto" mode (`touch-action: none` only then); toggle visible on all devices
- [x] Directional buttons and arrow keys: 2%, 10% with Shift; live position announcement; buttons disabled on an axis without free space
- [x] "Redefinir posição" (`textLayout = null`); placement kept across model changes, applied to the destination safe area
- [x] Overflow warning and placement unchanged; export blocking recorded for M4
- [x] Unit, component, and Playwright tests, including measured text-pixel positions for all nine presets, multiline alignment, mouse and real touch drags, keyboard steps, model change, and reset

### Future (not scheduled)

- Per-line text-length limit (P-14). Recorded only; nothing enforces it and no limit is invented.

## M4 — Image export

Status: **Done** (accepted 2026-11-08, D-008, D-009). Evidence: typecheck, lint, format check, 515 unit tests, production build, demo isolation check, demo build with markers present, and 90 Playwright tests passed (2 intentionally skipped per device).

- [x] "Exportar imagem" in the preview panel; PNG of the preview's own scene through `drawScene` (no second composition)
- [x] Native size of the base image, never upscaled, longest edge ≤ 4000 px, aspect preserved; dimensions validated before allocating the canvas
- [x] Opaque white background in preview and export (the transparent corners of earlier versions are now white)
- [x] `taavi-{plateId}.png`, sanitized and length-limited; no customer text
- [x] Blocked for incomplete/invalid configurations and any preview notice (images pending/loading/failed, selected frame missing/broken/uncalibrated, text area pending, provisional color, overflow); unselected frames block nothing
- [x] Focusable `aria-disabled` button with listed reasons; click and keyboard activation ignored while blocked; pt-BR success and failure feedback; failures leave the UI usable
- [x] Blocked-axis correction (from M4.1b-2): directional buttons and arrow keys no longer change the stored coordinate of an axis without free space
- [x] Unit, component, and Playwright tests: real downloads, PNG header and decoded dimensions, white background, layer order, colors, text position, and preview/export consistency at normalized coordinates on desktop and mobile
- Real-photo export depends on M1.3b (photographs and calibration) and P-02 (lettering palette).
- **Acceptance criterion (D-039):** the preview and the exported image render the same font family lettering colors (including secondary ranges, M4.1b-1), and text alignment and position (M4.1b-2), from the same scene (`buildScene` + `drawScene`).

## M4.2 — Catalog and customization UX simplification

Status: **Done** (accepted 2026-11-08, D-046, D-047). Evidence: typecheck, lint, format check, 430 unit tests, production build, demo isolation check, demo build with markers present, and 78 Playwright tests passed (2 intentionally skipped per device).

- [x] Labels as supplied: "Placa cerâmica — 10 × 10 cm", "Quadro — 20 × 20 cm", "Bandeja ondulada M — Aprox. 8 cm", "Bandeja ondulada G — Aprox. 11 cm" (`displayName — sizeLabel`); no dimensions invented
- [x] ID migration `bandeja-ondulada-m-11` → `bandeja-ondulada-g-11` (and the demo ID, asset folder, and generator output), recorded in D-046
- [x] The Quadro is one complete product with one photograph (Option A); the demo Quadro image now includes a synthetic wooden frame and its text area sits inside the ceramic
- [x] Frame concept removed: types, catalog collection, `supportsFrame`, `frameId`, validation and integrity codes, `selectPlate`/`getFrameOptions`, frame-cleared notice, composition and scene layers, frame notices and export blockers, "Moldura" field and summary row, demo frames and their PNGs; superseded decisions kept traceable
- [x] "Posição do texto": nine presets set alignment and position together, drawn as aligned-line glyphs, selected one inverted and named in text; "Alinhamento das linhas" removed; compact directional pad; drag, touch mode, reset, and keyboard unchanged
- [x] Lettering colors as labeled swatches on native radios; selected state with check mark and heavier border
- [x] "Usar segunda cor" disclosure; secondary swatches and selection actions only when relevant; collapsing keeps the color and trechos; "Remover segunda cor" clears both; invalid second color stays visible
- [x] Unit, component, and Playwright tests updated; preview/export consistency verified on the assembled Quadro

## M4.3 — Fixed lettering size

Status: **Done** (implemented 2026-11-08, not committed). Taavi's lettering molds have one size (D-055).

- [x] `TextLayout.fontSize`: fixed size per model as a fraction of the image width; validated in (0, 1]; optional, so pending models keep the catalog valid
- [x] Placa: 0.08625 (55.2 px on 640 px), half the former starting size; an initial visual reference, not a mold measurement
- [x] Shrinking removed: `layoutText` keeps line breaks and wrapping at the fixed size; vertical and horizontal overflow show the warning and block export
- [x] `text-size-pending`: a model with a text area but no approved size draws no text, says so, and blocks export; no fallback to fitting
- [x] Demo models use the same rule on their synthetic areas
- [x] Unit, component, and Chromium/WebKit tests: fixed size for short, long, wrapped, Unicode, and overflowing text; positions, drag, two colors, deboss, and preview/export consistency unchanged
- Pending: sizes for the Quadro and the Bandejas (P-15). Lettering colors stay a production-data dependency (P-02).

## M5 — Quality and usability

Status: Planned.

- Broader mobile/browser testing.
- Accessibility audit.
- Regression coverage and visual refinement.

## Future — Store integration

Status: Not scheduled.

- Nuvemshop integration, pricing, order workflows.
