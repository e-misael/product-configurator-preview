# Taavi Configurator

Visual configurator for Taavi's handmade ceramic plates. Customers choose a plate (Placa; square, rectangular, or circular), an optional frame (Quadro), color, and custom text, see a live preview, and export an image.

> **Status:** M2 — Functional configurator. The configuration form, validation feedback, and a placeholder preview work. The production catalog is intentionally empty until real product data is provided; use demo mode to try the workflow. See [docs/05-backlog.md](docs/05-backlog.md).

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

Opens the app at http://localhost:5173. With the empty production catalog it shows "Nenhuma placa disponível no momento."

```bash
npm run dev:demo
```

Runs the app with a synthetic, clearly labeled demonstration catalog (D-028). Demo data is never part of the production build.

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
  catalog/   Local, read-only product catalog (empty for now)
  components/ Configurator form and preview slot
  hooks/     useConfiguration state hook
  demo/      Demonstration catalog and banner (demo mode only)
  App.tsx    Application shell
scripts/     Build checks (demo isolation)
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

Contributor and AI-assistant guidance: [CLAUDE.md](CLAUDE.md).
