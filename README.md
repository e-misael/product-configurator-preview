# Taavi Configurator

Visual configurator for Taavi's handmade ceramic plates. Customers choose a plate (Placa), an optional frame (Quadro), color, shape, and custom text, see a live preview, and export an image.

> **Status:** M0 — Foundation. The app shell, tooling, domain model, and validation exist. The product catalog is intentionally empty until real product data is provided. See [docs/05-backlog.md](docs/05-backlog.md).

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

Opens the app at http://localhost:5173.

## Commands

| Command                | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Start the Vite dev server                       |
| `npm run build`        | Typecheck and build for production into `dist/` |
| `npm run preview`      | Serve the production build locally              |
| `npm run typecheck`    | TypeScript type checking (strict)               |
| `npm run lint`         | ESLint (incl. accessibility rules)              |
| `npm run format`       | Format all files with Prettier                  |
| `npm run format:check` | Verify formatting                               |
| `npm test`             | Run unit tests (Vitest)                         |
| `npm run test:watch`   | Unit tests in watch mode                        |
| `npm run test:e2e`     | Build, serve, and run Playwright tests          |
| `npm run check`        | typecheck + lint + format:check + unit tests    |

Playwright runs on desktop Chromium, mobile Chromium, and mobile WebKit (smoke tests only). CI (GitHub Actions) runs typecheck, lint, format check, unit tests, and build.

## Project structure

```text
src/
  domain/    Domain types and pure validation
  catalog/   Local, read-only product catalog (empty for now)
  App.tsx    Application shell
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
