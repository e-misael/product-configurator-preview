# TAAVI Configurator

Visual configurator for TAAVI's handmade ceramics: the customer picks a model (Modelo: Placa cerâmica, Quadro, Bandeja ondulada M and G; in code a `Plate`; the Quadro is one complete product, plate plus wooden frame, photographed assembled) and text; sees a real-time preview; exports an image. The ceramic color is fixed per model and read-only. Static client-side app, independent from Nuvemshop. Internal business tool, **not** SaaS.

## Read first

| Topic                              | Doc                                                    |
| ---------------------------------- | ------------------------------------------------------ |
| Purpose, scope, out-of-scope       | [docs/01-product-vision.md](docs/01-product-vision.md) |
| Requirements (FR-xx) + acceptance  | [docs/02-requirements.md](docs/02-requirements.md)     |
| Layers, rendering, export, testing | [docs/03-architecture.md](docs/03-architecture.md)     |
| Types and validation rules         | [docs/04-data-model.md](docs/04-data-model.md)         |
| Increments M0–M5 and status        | [docs/05-backlog.md](docs/05-backlog.md)               |
| Decisions (approved vs proposed)   | [docs/06-decisions.md](docs/06-decisions.md)           |
| Product image assets and placement | [docs/07-product-assets.md](docs/07-product-assets.md) |
| Deployment runbook (Cloudflare)    | [docs/08-deployment.md](docs/08-deployment.md)         |

## MVP boundaries

In scope: model (fixed shape classification: square, rectangle, circle, scalloped), fixed read-only ceramic color, text with font family, up to two lettering colors, position presets that also set the alignment (M4.1b, M4.2), live preview, PNG image export (M4), sharing the PNG and an order request through the device's share sheet or a WhatsApp link (M5.1, D-076).
Out of scope: a separately chosen frame (Moldura) or frame layers (D-046), customer image uploads of any kind (file picker, drag-and-drop, image URLs, image storage or upload APIs; images are curated by TAAVI in the catalog only, FR-09, D-045), Nuvemshop integration, cart, checkout, orders, payments, accounts, auth, database, backend, cloud storage, inventory, pricing, AI previews, 3D, admin, analytics. Do not add these or abstractions for them.

## Stack

React 19, TypeScript strict (`~6.0`), Vite 8, ESLint 9 + jsx-a11y, Prettier, Vitest + jsdom + RTL, Playwright, npm. No UI library, no global state library (D-003, D-004).

## Structure

```text
src/domain/    pure types + validation (no React/DOM)
src/catalog/   catalog data (data.ts) + getCatalog() entry point — deep-frozen source of truth
src/components/ configurator form + canvas preview
src/config/    contact.ts: TAAVI's official WhatsApp number (P-16, supplied by the owner; never a placeholder)
src/hooks/     useConfiguration, useImages, useLetteringFont, usePreparedPng
src/preview/   pure composition + scene layout + text fit; canvas painting
src/demo/      demo-mode catalog, banner, and public/ synthetic images (never in production builds, D-028, D-036)
src/App.tsx    app shell
scripts/       build checks (demo isolation, release), deployment, demo image generator
tests/unit/    Vitest (fixtures prefixed `test-`)
tests/e2e/     Playwright
docs/          product and technical docs
.claude/       skills and agents
```

Future folders (`services`, `public/catalog/plates/{owner-id}/` — real images only, D-031) are created only by the increment that needs them.

## Domain invariants

- **Never invent product data**: no dimensions, colors, HEX values, typography, or assets. Unknown → `{ status: 'pending' }` or omitted.
- Stable string IDs; never array positions.
- Catalog is deep-frozen and must pass `validateCatalog` (test gate); configuration stores only IDs and raw user input.
- Validation reports `valid` / `incomplete` / `invalid`; it never replaces a selection.
- Text is stored exactly as typed.
- There is no frame entity, field, or layer: the Quadro's frame is part of the product and of its one photograph (D-046). Do not reintroduce frames without a new approved decision.
- The ceramic color is a catalog property of the model (`ceramicColor`), never a configuration field. Size labels are display text as supplied; `dimensions` holds only sizes confirmed by TAAVI (P-01).
- Preview and export must represent the same configuration, composed from the same **real product images** (D-027). No CSS tinting of photos to fake ceramic colors; vector/synthetic visuals are demo-only.

## Architecture principles

Simplicity first. Domain logic pure and tested. Rendering contains no product rules. No premature abstraction for future integration.

## Language

Code, docs, comments in English. UI text in pt-BR; the generic term is "Modelo", and product names and size labels such as "Placa cerâmica — 10 × 10 cm" and "Quadro" are kept as supplied.

## Commands

```bash
npm run dev           # dev server
npm run check         # typecheck + lint + format:check + unit tests
npm run test:e2e      # Playwright (builds and serves the app)
npm run build
npm run release:verify   # every gate + production build + release checks (before any deployment)
npm run deploy:beta      # only with the owner's authorization (docs/08-deployment.md)
```

## Testing expectations

- Every domain rule has a unit test (valid, incomplete, invalid cases).
- UI changes: RTL tests by role/label; Playwright for flows and responsive checks.
- Report only checks that were actually executed.

## Skills and agents

| Name                | Use for                                                        |
| ------------------- | -------------------------------------------------------------- |
| `implement-feature` | Any increment or feature: plan → approval → implement → verify |
| `product-domain`    | Domain rules, catalog data, validation                         |
| `visual-ux`         | UI, layout, preview, accessibility                             |
| `quality-check`     | Running and reporting validation checks                        |
| `qa-reviewer` agent | Independent review of proposed or completed changes            |

## Workflow

1. Read relevant docs and code.
2. Propose a focused plan; **wait for explicit approval**.
3. Implement only the approved increment; no unrelated refactoring.
4. Add/update tests; run `quality-check`.
5. Report changes, results, risks, open decisions; suggest a commit message.

Do not start the next increment automatically.

## Definition of Done

Typecheck, lint, format check, unit tests, and relevant Playwright tests pass (actually executed); docs updated (requirements status, backlog, decisions); no invented data; no out-of-scope features.

## Git

Never commit or push unless explicitly instructed. Use Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`).
