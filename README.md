# Taavi Configurator

Visual configurator for Taavi's handmade ceramics. Customers choose a model (Placa cerâmica, Quadro, or Bandeja ondulada M in two sizes), an optional frame (Moldura) where a model takes one, and custom text, see a live preview, and export an image. The ceramic color is fixed per model (Bege) and shown read-only.

> **Status:** M4.1b-1 — Typography and lettering colors. The four supplied models are registered in the production catalog (IDs provisional, no photographs or measurements yet, so the preview says the photo is pending). The text has a font choice, a required lettering color, and an optional second color for selected characters; the production lettering palette is not supplied yet, so a production configuration cannot be completed. The configuration form, validation feedback, and a Canvas preview that composes catalog images work, verified with synthetic demo images only; use demo mode to try the full workflow. Text positioning (M4.1b-2) and PNG export (M4) are not implemented. See [docs/05-backlog.md](docs/05-backlog.md).

## Requirements

- Node.js 24 (see `.nvmrc`)
- npm 11+

## Setup

```bash
npm install
npx playwright install chromium webkit   # only needed for end-to-end tests
```

## Development

```bash
npm run dev
```

Opens the app at http://localhost:5173. The production catalog lists the four models without photographs.

```bash
npm run dev:demo
```

Runs the app with a synthetic, clearly labeled demonstration catalog and synthetic images (D-028, D-036). Demo data and images are never part of the production build.

## Commands

| Command                        | Description                                     |
| ------------------------------ | ----------------------------------------------- |
| `npm run dev`                  | Start the Vite dev server                       |
| `npm run build`                | Typecheck and build for production into `dist/` |
| `npm run preview`              | Serve the production build locally              |
| `npm run dev:demo`             | Dev server with the demonstration catalog       |
| `npm run build:demo`           | Build demo mode into `dist-demo/`               |
| `npm run preview:demo`         | Serve the demo build locally                    |
| `npm run check:demo-isolation` | Verify `dist/` contains no demo data            |
| `npm run generate:demo-assets` | Regenerate the synthetic demo images            |
| `npm run typecheck`            | TypeScript type checking (strict)               |
| `npm run lint`                 | ESLint (incl. accessibility rules)              |
| `npm run format`               | Format all files with Prettier                  |
| `npm run format:check`         | Verify formatting                               |
| `npm test`                     | Run unit tests (Vitest)                         |
| `npm run test:watch`           | Unit tests in watch mode                        |
| `npm run test:e2e`             | Build, serve, and run Playwright tests          |
| `npm run check`                | typecheck + lint + format:check + unit tests    |

Playwright builds and serves both the production build (smoke tests on desktop Chromium and mobile WebKit) and the demo build (functional flows on desktop and mobile Chromium; smoke on mobile WebKit). CI (GitHub Actions) runs typecheck, lint, format check, unit tests, build, and the demo isolation check.

## Project structure

```text
src/
  domain/    Domain types and pure validation
  catalog/   Local, read-only product catalog (four models, no images yet)
  components/ Configurator form and preview slot
  hooks/     useConfiguration state hook
  preview/   Pure preview composition, layout, text fitting; canvas painting
  demo/      Demonstration catalog, banner, and public/ images (demo mode only)
  App.tsx    Application shell
scripts/     Build checks (demo isolation), demo image generator
tests/
  unit/      Vitest tests
  e2e/       Playwright tests
docs/        Product and technical documentation
.claude/     Claude Code skills and QA agent
```

## Documentation

1. [Product vision](docs/01-product-vision.md)
2. [Requirements](docs/02-requirements.md)
3. [Architecture](docs/03-architecture.md)
4. [Data model](docs/04-data-model.md)
5. [Backlog](docs/05-backlog.md)
6. [Decisions](docs/06-decisions.md)
7. [Product assets](docs/07-product-assets.md)

Contributor and AI-assistant guidance: [CLAUDE.md](CLAUDE.md).
