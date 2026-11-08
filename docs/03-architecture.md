# 03 — Architecture

## Technology stack

| Concern    | Choice                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------- |
| UI         | React 19                                                                                 |
| Language   | TypeScript 6.0, strict mode (+ `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| Build/dev  | Vite 8                                                                                   |
| Lint       | ESLint 9 (flat config), typescript-eslint, react-hooks, react-refresh, jsx-a11y          |
| Format     | Prettier                                                                                 |
| Unit tests | Vitest + jsdom + React Testing Library                                                   |
| E2E tests  | Playwright (desktop Chromium, mobile Chromium, mobile WebKit smoke)                      |
| CI         | GitHub Actions: typecheck, lint, format check, unit tests, build                         |

Version pins: TypeScript is held at `~6.0` because typescript-eslint supports `<6.1`; ESLint is held at 9 because eslint-plugin-jsx-a11y does not yet support ESLint 10. See D-001.

## Application boundaries

A static, client-only single-page app. No backend, database, authentication, or network calls. All product data is local and version-controlled.

## Layers

```text
catalog data (src/catalog)  ──►  domain (src/domain)  ◄──  configuration state (useConfiguration)
                                     │
                                     ▼
                  composePreview → buildScene (src/preview, pure)  ◄──  image loading (useImages)
                              │                 │
                              ▼                 ▼
                    drawScene on a canvas   export service (M4, reuses drawScene)
                    (components/preview)    (services/)
```

Rules:

- **Domain** (`src/domain`) is pure TypeScript: types, configuration and catalog validation, and lookup helpers. No React, no DOM.
- **Catalog** (`src/catalog`) is read-only data and the single source of truth for available components. UI never mutates it.
- **Configuration state** holds only IDs and user input. It never copies catalog data.
- **Rendering** consumes a composition derived from catalog + configuration and contains no product rules.
- **Product imagery** is resolved from catalog asset references at composition time. It is never stored in configuration state and never read by domain validation (D-027).

## Target structure

```text
src/
├── App.tsx, main.tsx, index.css
├── domain/           # types, configuration validation, catalog validation
├── catalog/          # data.ts, deep-freeze.ts, index.ts (getCatalog)
├── components/
│   ├── configurator/ # form controls (M2)
│   └── preview/      # canvas preview and its messages (M3.1)
├── hooks/            # useConfiguration (M2), useImages (M3.1)
├── preview/          # pure composition, scene layout, text fitting; canvas painting (M3.1)
├── demo/             # demo catalog, banner, and public/ with synthetic images (demo mode only)
└── services/         # export (M4)
public/catalog/{plates,frames}/{owner-id}/  # real images (M1.3b; docs/07)
tests/{unit,e2e}/
```

Directories are created only when their increment needs them.

## Catalog architecture

| Module                             | Responsibility                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/catalog/data.ts`              | Raw, version-controlled definitions (`catalogData`). Never imported directly by app code.           |
| `src/catalog/deep-freeze.ts`       | Small recursive freeze (no dependency).                                                             |
| `src/catalog/index.ts`             | Single entry point: `getCatalog(): Catalog` — synchronous, deeply frozen, same instance every call. |
| `src/domain/catalog-validation.ts` | Pure `validateCatalog(catalog)` integrity check.                                                    |

- Components are referenced by stable kebab-case string IDs, unique across the whole catalog (D-019).
- Asset references are same-origin paths `/catalog/{plates|frames}/{owner-id}/…` validated by catalog integrity (D-031); a missing asset must degrade gracefully, never crash.
- Unknown dimensions are `{ status: 'pending' }`.
- The catalog is **empty** until the store provides real data.

### Catalog integrity and immutability

- **Integrity** (D-018): `validateCatalog` reports every definition problem with an explicit code and path. It never repairs, filters, or reorders data. Rules: [04-data-model.md](04-data-model.md#catalog-integrity-rules).
- **Immutability** (D-020): `getCatalog()` returns the catalog deep-frozen at module load. Collections, components, compatibility lists, dimension and asset objects all reject mutation at runtime, in addition to the `readonly` types.
- **When validation runs** (D-021): as a **test gate**. `tests/unit/catalog/catalog.test.ts` asserts `validateCatalog(getCatalog())` is `valid`; it runs in `npm test`, `npm run check`, and CI, so an invalid catalog cannot pass CI. `getCatalog()` does not validate at runtime, so a catalog defect never crashes the customer page.
- **Separation:** catalog validation checks the catalog against itself; configuration validation checks a user selection against a catalog assumed to have passed the gate.
- Later increments (M1.2+) must obtain catalog data only through `getCatalog()`. ESLint `no-restricted-imports` blocks imports of `catalog/data` outside `src/catalog/**` and `tests/unit/catalog/**` (D-020).

## Configuration state

- Plain serializable object (`Configuration`), all selections nullable, text stored raw. No shape or color field: the shape is derived from the selected model (`getPlateShape`, D-023) and the fixed ceramic color belongs to the catalog (D-041).
- Selection transitions are pure domain functions in `src/domain/selection.ts`. `selectPlate` explicitly clears a frame when the new plate does not support frames and returns `cleared` so the UI can announce it (D-026). `getFrameOptions` lists the frames that can be offered for a plate.
- Frame support is an explicit plate capability (`supportsFrame`, D-024). Application code never tests `shape === 'circle'`; the circle rule is enforced once, by catalog integrity.
- `useConfiguration(catalog)` (`src/hooks`) holds the configuration in React state, exposes one action per field, derives `validation` with `validateConfiguration`, and raises a one-off `frame-cleared` notice when `selectPlate` clears a frame. No global state library (D-003).
- The catalog reaches the UI as a prop of `App` (default `getCatalog()`), so tests and demo mode can supply their own.

## User interface (M2)

- `src/components/configurator/`: one fieldset per field (Modelo, Moldura (opcional), Texto, Fonte, Cor do texto, Segunda cor (opcional)) built from native radios and a textarea, plus a status summary. The Moldura fieldset is hidden when the model takes no frame, and the fixed "Cor da peça" is shown as read-only text inside Modelo. Controls are generated from catalog data and domain helpers; pt-BR labels and messages live in `messages.ts`.
- Message placement (D-029): invalid issues next to their field; missing fields in the summary.
- Kept-but-invalid selections stay visible with remove/replace actions (D-030).
- `src/components/preview/PreviewPanel.tsx`: the preview slot. In M2 it shows a labeled placeholder and a text summary; M3 replaces its content with the composed real-image renderer.

## Demo mode (D-028)

`vite --mode demo` loads `src/demo/` (synthetic catalog + banner) through a dynamic import guarded by `import.meta.env.MODE`; production builds tree-shake it away. `scripts/check-demo-isolation.js dist` scans every built file for demo markers and runs in CI. Demo data never enters `src/catalog/data.ts`.

## Domain validation

`validateConfiguration(config, catalog)` returns one of:

- `valid`
- `incomplete` — only missing required selections
- `invalid` — at least one selection conflicts with the catalog (takes precedence)

Validation reports issues; it never auto-corrects a selection. Any future auto-adjustment must be explicit, visible to the user, and recorded as a decision.

## Product imagery strategy (approved requirement — D-027, FR-08)

The final preview and export are composed from **real product image assets** for plates and frames. Vector shapes are temporary demonstration output only.

### Responsibilities

| Concern                      | Owner                                         | Notes                                                                      |
| ---------------------------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| Which product is selected    | `Configuration` (IDs only)                    | No image URLs, sizes, or pixel data.                                       |
| Whether a selection is valid | Domain validation                             | Never depends on image availability.                                       |
| Which image represents it    | Catalog asset references (`AssetRef`)         | Local, version-controlled files under `public/catalog/`.                   |
| How layers are placed        | Composition model (M3), from catalog metadata | Scaling, alignment, text area, frame aperture. Pending real assets (P-07). |
| Drawing                      | Preview renderer / export service             | Same composition and same image sources for both.                          |

### Rules

- **Layered composition** (bottom to top): image of the selected model → optional frame image → personalized text. Each layer comes from catalog data; rendering code contains no per-product coordinates.
- **Color and finish** are represented by the real photograph of the model (its ceramic color is fixed, D-041). **No CSS tint, filter, or blend over a photograph** to simulate a ceramic color. If the model's image is missing, the UI shows a visible "image unavailable" state instead of an approximation.
- **Missing assets** degrade visibly and never substitute another product's image (FR-06.4).
- **Same-origin assets.** Images are served from `public/catalog/` so the export can rasterize them without cross-origin restrictions.
- **No invented photographs.** Production images come only from the store. Synthetic demonstration assets for workflow testing live under `tests/` (or a clearly named non-production fixture location), are labeled as demonstration content, and never enter `src/catalog/data.ts`.
- **Independence.** The image strategy can change (file formats, resolutions, a different renderer) without changing `Configuration`, domain validation, or catalog integrity rules beyond asset-reference checks.

### Implications for M2 (configuration interface)

- The UI includes a **preview slot** (`PreviewPanel`), separate from the form. In M2 it shows a neutral, explicitly labeled placeholder and a text summary; it does not show generic vector "products" presented as the real item. The composition function that will feed it is introduced in M3.
- Controls read display data (names, availability, shape) from the catalog via `getCatalog()` and domain helpers; they never reference image files directly.
- Thumbnails in selection controls, if added, use the same `AssetRef` data and the same missing-asset behavior.

### Implications for M1.3 / M3 (catalog and renderer)

- **Catalog contract (M1.3a, revised by M4.1a):** `Plate.image` holds the model's single photograph (D-041, which superseded the per-color variations of D-032); `Frame.images` holds `back`/optional `front` layers per compatible plate model (D-033); optional `NormalizedBox` placement (`objectBounds`, `text.area`, `platePlacement`) in image coordinates (D-034). Pure lookups `findPlateImage` / `findFrameImage` return `available` or `pending` by exact match. Real files and calibration values arrive in M1.3b. Details: [07-product-assets.md](07-product-assets.md).
- **Layer contract for M3:** frame `back` → plate image placed so its `objectBounds` fill `platePlacement` (or the plate image alone when no frame) → text inside `text.area` → frame `front`. A `pending` lookup or an image that fails to load (renderer `error` event) shows a visible unavailable state; nothing is substituted. Clipping/masking of circular or irregular outlines is an M3 decision: a bounding box does not describe them.
- **Text boundary:** raw text (`Configuration`), layout (catalog `TextLayout`), and typography/material effects (M3+, pending P-04) are separate; stamped or raised lettering is not assumed reproducible with plain text.
- **Renderer (D-035):** Canvas 2D, decided in M3.1 (see "Preview rendering").

## Preview rendering (implemented in M3.1 — D-035–D-038)

```text
Configuration + validation + catalog
  └─ composePreview (pure)  → plate / frame / text layers + notice codes   (exact image lookup, D-033/D-041)
       └─ useImages         → per-file state: loading | loaded | error      (same-origin, browser-cached)
            └─ buildScene (pure, text measured by a passed-in function)
                 → positioned layers in painting order + notices
                      └─ drawScene → canvas (PreviewCanvas)
```

- **Single renderer: Canvas 2D (D-035).** Export (M4) will call `drawScene` on another canvas; preview and export share one code path. Rendering code contains no product rules and no per-product coordinates: every position comes from catalog `NormalizedBox` data and the images' natural sizes.
- **Layer order (D-037):** frame back → plate → text → frame front. The scene's logical size is the base image's natural size (the frame back when framed). The plate's `objectBounds` (the whole photograph when pending) are scaled uniformly to fit and centered in the frame's `platePlacement`; the text area is a fraction of the placed plate image; the front layer covers the frame image. Frame layers must share an aspect ratio (1% tolerance), otherwise the frame is not drawn.
- **When positioning data is pending:** a frame without `platePlacement` is not drawn (the plate is shown alone, with a message); a plate without `text.area` gets no text on the image (a message says so; the entered text stays in the configuration and the summary); a plate without `objectBounds` is fitted by its whole photograph, which is only correct for tightly cropped images. No values are ever guessed.
- **Missing and broken images (D-037):** `composePreview` reports catalog-pending states; `useImages` and `buildScene` report loading and load failures. They are shown as distinct messages (`components/preview/messages.ts`, `aria-live="polite"`). Nothing is drawn until every needed file has settled, and nothing is substituted.
- **Resolution:** the canvas CSS width follows its container; the backing store is `displayed width × devicePixelRatio` (clamped to 1–3), capped at the base image's width. Aspect ratio comes from the images, never stretched.
- **Text (D-038):** provisional fitting in `src/preview/text-fit.ts`; no stamped or raised effect. Wrapped lines keep their source offsets, so `src/preview/text-style.ts` splits each line into colored segments from the secondary ranges (D-043); single-color lines are drawn aligned as before, mixed-color lines as consecutive runs. The font family maps to provisional system stacks (P-14); a neutral fallback color is used until a lettering color is chosen.
- **Accessibility:** the canvas has `role="img"`, a name from the images' `alt`, and is described by the text summary of the selection beside it.
- **Masking:** circular and irregular outlines come from the image's own transparency; a bounding box cannot describe them. Whether a separate mask is needed is an M3.2 decision with real photographs.
- **Demo images:** served only in demo mode from `src/demo/public/` (D-036).
- **Tests:** composition, layout, text fitting, drawing (recording fake context), `useImages`, and the React panel are unit/component tested; Playwright reads canvas pixels from the demo build.

## Export strategy (proposed — D-008, D-009)

Proposed: rasterize the same composition used by the preview to PNG on the client, from the same image sources. Resolution, transparency, background, and file naming are open decisions to be confirmed in M4. Export resolution must be chosen with the resolution of the real source images in mind (P-08).

## Testing strategy

| Level     | Tool                     | Scope                                                                                                                                                                       |
| --------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit      | Vitest                   | Domain validation, pure helpers, composition model                                                                                                                          |
| Component | Vitest + RTL             | Form controls, accessibility roles/labels                                                                                                                                   |
| E2E       | Playwright               | Production smoke (empty catalog, no demo data); demo-build user flows and responsive layout; mobile WebKit smoke only                                                       |
| Visual    | Playwright canvas pixels | Layer order, exact image selection, placement, text rows, load failures, responsive size — using synthetic demonstration images (M3.1). Preview/export consistency from M4. |

Unit tests use fake fixtures prefixed `test-`; they are never real product data.

## Future integration considerations

Nuvemshop integration is out of scope. The serializable `Configuration` plus an exported image is expected to be the hand-off contract to the store later. No integration code or abstractions exist now.

## Assumptions

- A1: Shape is a fixed classification of each model (D-023, D-040) and the ceramic color is fixed per model (D-041) (confirmed).
- A2: The app can be fully static and client-side for the MVP.
- A3: Frame–plate compatibility can be expressed declaratively in catalog data; physical fit requires real dimensions and mounting data (pending).
- A4: Per-model options may be needed later; an optional field on `Plate` can carry them without changing `Configuration`.
- A5: The store will provide real product images for each model and each frame, with enough consistency (framing, lighting, resolution) to be layered. Format, resolution, and placement metadata are pending (P-06–P-08).
