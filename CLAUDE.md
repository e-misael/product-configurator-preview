# Taavi Configurator

Visual configurator for Taavi's handmade ceramic plates: the customer picks a plate (Placa), optional frame (Quadro), color, shape, and text; sees a real-time preview; exports an image. Static client-side app, independent from Nuvemshop. Internal business tool, **not** SaaS.

## Read first

| Topic                              | Doc                                                    |
| ---------------------------------- | ------------------------------------------------------ |
| Purpose, scope, out-of-scope       | [docs/01-product-vision.md](docs/01-product-vision.md) |
| Requirements (FR-xx) + acceptance  | [docs/02-requirements.md](docs/02-requirements.md)     |
| Layers, rendering, export, testing | [docs/03-architecture.md](docs/03-architecture.md)     |
| Types and validation rules         | [docs/04-data-model.md](docs/04-data-model.md)         |
| Increments M0–M5 and status        | [docs/05-backlog.md](docs/05-backlog.md)               |
| Decisions (approved vs proposed)   | [docs/06-decisions.md](docs/06-decisions.md)           |

## MVP boundaries

In scope: plate, frame (optional), color category/color, shape, text, live preview, image export.
Out of scope: Nuvemshop integration, cart, checkout, orders, payments, accounts, auth, database, backend, cloud storage, inventory, pricing, AI previews, 3D, admin, analytics. Do not add these or abstractions for them.

## Stack

React 19, TypeScript strict (`~6.0`), Vite 8, ESLint 9 + jsx-a11y, Prettier, Vitest + jsdom + RTL, Playwright, npm. No UI library, no global state library (D-003, D-004).

## Structure

```text
src/domain/    pure types + validation (no React/DOM)
src/catalog/   read-only catalog data — the source of truth
src/App.tsx    app shell
tests/unit/    Vitest (fixtures prefixed `test-`)
tests/e2e/     Playwright
docs/          product and technical docs
.claude/       skills and agents
```

Future folders (`components/configurator`, `components/preview`, `hooks`, `services`, `public/catalog/*`) are created only by the increment that needs them.

## Domain invariants

- **Never invent product data**: no dimensions, colors, HEX values, typography, or assets. Unknown → `{ status: 'pending' }` or omitted.
- Stable string IDs; never array positions.
- Catalog is read-only; configuration stores only IDs and raw user input.
- Validation reports `valid` / `incomplete` / `invalid`; it never replaces a selection.
- Text is stored exactly as typed.
- Frame compatibility is declared explicitly; matching shape ≠ physical fit.
- Preview and export must represent the same configuration.

## Architecture principles

Simplicity first. Domain logic pure and tested. Rendering contains no product rules. No premature abstraction for future integration.

## Language

Code, docs, comments in English. UI text in pt-BR; keep "Placa" and "Quadro".

## Commands

```bash
npm run dev           # dev server
npm run check         # typecheck + lint + format:check + unit tests
npm run test:e2e      # Playwright (builds and serves the app)
npm run build
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
