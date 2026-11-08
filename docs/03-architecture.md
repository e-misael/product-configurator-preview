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
catalog data (src/catalog)  ──►  domain (src/domain)  ◄──  configuration state (hooks, M2)
                                     │
                                     ▼
                         composition model (M3, proposed)  ◄──  image asset resolution (M3)
                              │                 │                 (catalog asset refs → URLs)
                              ▼                 ▼
                    preview renderer      export service (M4)
                    (components/preview)  (services/)
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
│   └── preview/      # SVG preview (M3)
├── hooks/            # configuration state hook (M2)
└── services/         # export (M4)
public/catalog/{placas,quadros}/  # visual assets (M1, when provided)
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
- Asset references are paths under `public/catalog/`; a missing asset must degrade gracefully, never crash.
- Unknown dimensions are `{ status: 'pending' }`.
- The catalog is **empty** until the store provides real data.

### Catalog integrity and immutability

- **Integrity** (D-018): `validateCatalog` reports every definition problem with an explicit code and path. It never repairs, filters, or reorders data. Rules: [04-data-model.md](04-data-model.md#catalog-integrity-rules).
- **Immutability** (D-020): `getCatalog()` returns the catalog deep-frozen at module load. Collections, components, compatibility lists, dimension and asset objects all reject mutation at runtime, in addition to the `readonly` types.
- **When validation runs** (D-021): as a **test gate**. `tests/unit/catalog/catalog.test.ts` asserts `validateCatalog(getCatalog())` is `valid`; it runs in `npm test`, `npm run check`, and CI, so an invalid catalog cannot pass CI. `getCatalog()` does not validate at runtime, so a catalog defect never crashes the customer page.
- **Separation:** catalog validation checks the catalog against itself; configuration validation checks a user selection against a catalog assumed to have passed the gate.
- Later increments (M1.2+) must obtain catalog data only through `getCatalog()`. ESLint `no-restricted-imports` blocks imports of `catalog/data` outside `src/catalog/**` and `tests/unit/catalog/**` (D-020).

## Configuration state

- Plain serializable object (`Configuration`), all selections nullable, text stored raw. No shape field: the shape is derived from the selected plate (`getPlateShape`, D-023).
- Selection transitions are pure domain functions in `src/domain/selection.ts`. `selectPlate` explicitly clears a frame when the new plate does not support frames and returns `cleared` so the UI can announce it (D-026). `getFrameOptions` lists the frames that can be offered for a plate.
- Frame support is an explicit plate capability (`supportsFrame`, D-024). Application code never tests `shape === 'circle'`; the circle rule is enforced once, by catalog integrity.
- Planned for M2: a single `useConfiguration` hook with React state. No global state library unless proven necessary (D-003).

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

- **Layered composition** (bottom to top): plate image for the selected plate model and color variation → optional frame image → personalized text. Each layer comes from catalog data; rendering code contains no per-product coordinates.
- **Color and finish** are represented by images (or other store-approved visual data) of the actual variation. **No CSS tint, filter, or blend over a photograph** to simulate a ceramic color. If the image for a selected variation is missing, the UI shows a visible "image unavailable" state instead of an approximation.
- **Missing assets** degrade visibly and never substitute another product's image (FR-06.4).
- **Same-origin assets.** Images are served from `public/catalog/` so the export can rasterize them without cross-origin restrictions.
- **No invented photographs.** Production images come only from the store. Synthetic demonstration assets for workflow testing live under `tests/` (or a clearly named non-production fixture location), are labeled as demonstration content, and never enter `src/catalog/data.ts`.
- **Independence.** The image strategy can change (file formats, resolutions, a different renderer) without changing `Configuration`, domain validation, or catalog integrity rules beyond asset-reference checks.

### Implications for M2 (configuration interface)

- The UI includes a **preview slot** whose content is produced by a composition function, not by the form. In M2 it may show a neutral, explicitly labeled placeholder; it must not show generic vector "products" presented as the real item.
- Controls read display data (names, availability, shape) from the catalog via `getCatalog()` and domain helpers; they never reference image files directly.
- Thumbnails in selection controls, if added, use the same `AssetRef` data and the same missing-asset behavior.

### Implications for M1.3 / M3 (catalog and renderer)

- **Catalog model extensions (pending, P-06/P-07):** today `Plate.asset` and `Frame.assets` are single references. Real color/finish variations will need images per plate model × color (e.g. a color-keyed asset map), and layer placement needs metadata in image coordinates (text safe area, frame aperture/offset, scale relative to real dimensions). These will be designed from the actual assets in M1.3, with integrity checks for every new reference.
- **Renderer choice (D-007, still proposed):** with raster layers, SVG `<image>` composition and Canvas 2D are both viable. The choice is confirmed in M3 against preview/export pixel consistency, text rendering quality, and mobile performance.

## Preview rendering strategy (proposed — D-007)

SVG is the preferred initial strategy: resolution-independent, inspectable, testable in the DOM, and serializable for export. It is not irreversible; the composition model isolates the renderer so it can be swapped. With real product photographs (D-027), the SVG would compose raster `<image>` layers plus text; Canvas 2D remains the main alternative.

## Export strategy (proposed — D-008, D-009)

Proposed: rasterize the same composition used by the preview to PNG on the client, from the same image sources. Resolution, transparency, background, and file naming are open decisions to be confirmed in M4. Export resolution must be chosen with the resolution of the real source images in mind (P-08).

## Testing strategy

| Level        | Tool                 | Scope                                                                                                                    |
| ------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Unit         | Vitest               | Domain validation, pure helpers, composition model                                                                       |
| Component    | Vitest + RTL         | Form controls, accessibility roles/labels                                                                                |
| E2E          | Playwright           | Smoke, responsive layout, user flows; mobile WebKit smoke only                                                           |
| Visual (M3+) | Playwright snapshots | Preview regression, preview/export consistency (layer order, placement, no tinting) using synthetic demonstration images |

Unit tests use fake fixtures prefixed `test-`; they are never real product data.

## Future integration considerations

Nuvemshop integration is out of scope. The serializable `Configuration` plus an exported image is expected to be the hand-off contract to the store later. No integration code or abstractions exist now.

## Assumptions

- A1: Shape is a fixed property of each plate model (D-023); color is a user selection constrained by the selected plate (confirmed).
- A2: The app can be fully static and client-side for the MVP.
- A3: Frame–plate compatibility can be expressed declaratively in catalog data; physical fit requires real dimensions and mounting data (pending).
- A4: Variant-level availability (e.g. specific colors per plate model) may be needed later; the plate-level lists can be extended without changing `Configuration`.
- A5: The store will provide real product images for each plate model, each color/finish variation, and each frame, with enough consistency (framing, lighting, resolution) to be layered. Format, resolution, and placement metadata are pending (P-06–P-08).
