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
                         composition model (M3, proposed)
                              │                 │
                              ▼                 ▼
                    preview renderer      export service (M4)
                    (components/preview)  (services/)
```

Rules:

- **Domain** (`src/domain`) is pure TypeScript: types, configuration and catalog validation, and lookup helpers. No React, no DOM.
- **Catalog** (`src/catalog`) is read-only data and the single source of truth for available components. UI never mutates it.
- **Configuration state** holds only IDs and user input. It never copies catalog data.
- **Rendering** consumes a composition derived from catalog + configuration and contains no product rules.

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

## Preview rendering strategy (proposed — D-007)

SVG is the preferred initial strategy: resolution-independent, inspectable, testable in the DOM, and serializable for export. It is not irreversible; the composition model isolates the renderer so it can be swapped.

## Export strategy (proposed — D-008, D-009)

Proposed: rasterize the same SVG composition used by the preview to PNG on the client. Resolution, transparency, background, and file naming are open decisions to be confirmed in M4.

## Testing strategy

| Level        | Tool                 | Scope                                                          |
| ------------ | -------------------- | -------------------------------------------------------------- |
| Unit         | Vitest               | Domain validation, pure helpers, composition model             |
| Component    | Vitest + RTL         | Form controls, accessibility roles/labels                      |
| E2E          | Playwright           | Smoke, responsive layout, user flows; mobile WebKit smoke only |
| Visual (M3+) | Playwright snapshots | Preview regression, preview/export consistency                 |

Unit tests use fake fixtures prefixed `test-`; they are never real product data.

## Future integration considerations

Nuvemshop integration is out of scope. The serializable `Configuration` plus an exported image is expected to be the hand-off contract to the store later. No integration code or abstractions exist now.

## Assumptions

- A1: Shape is a fixed property of each plate model (D-023); color is a user selection constrained by the selected plate (confirmed).
- A2: The app can be fully static and client-side for the MVP.
- A3: Frame–plate compatibility can be expressed declaratively in catalog data; physical fit requires real dimensions and mounting data (pending).
- A4: Variant-level availability (e.g. specific colors per plate model) may be needed later; the plate-level lists can be extended without changing `Configuration`.
