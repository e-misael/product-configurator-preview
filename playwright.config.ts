import { defineConfig, devices } from '@playwright/test';

const PRODUCTION_PORT = 4173;
const DEMO_PORT = 4174;
const production = `http://localhost:${PRODUCTION_PORT}`;
const demo = `http://localhost:${DEMO_PORT}`;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    // Production build (empty catalog, no demo data).
    {
      name: 'production-chromium',
      testMatch: 'production.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: production },
    },
    {
      name: 'production-mobile-webkit',
      testMatch: 'production.spec.ts',
      use: { ...devices['iPhone 14'], baseURL: production },
    },
    // Demo build (synthetic catalog) for functional flows (D-028).
    {
      name: 'demo-desktop-chromium',
      testMatch: ['configurator.spec.ts', 'preview.spec.ts', 'export.spec.ts', 'share.spec.ts'],
      use: { ...devices['Desktop Chrome'], baseURL: demo },
    },
    {
      name: 'demo-mobile-chromium',
      testMatch: ['configurator.spec.ts', 'preview.spec.ts', 'export.spec.ts', 'share.spec.ts'],
      use: { ...devices['Pixel 7'], baseURL: demo },
    },
    // Mobile-first layout at phone widths, by touch, in both engines (D-058).
    {
      name: 'layout-chromium',
      testMatch: 'mobile-layout.spec.ts',
      use: { ...devices['Pixel 7'], baseURL: demo },
    },
    {
      name: 'layout-webkit',
      testMatch: 'mobile-layout.spec.ts',
      use: { ...devices['iPhone 14'], baseURL: demo },
    },
    // Debossed lettering painted by the real drawing code (no app server needed).
    {
      name: 'rendering-chromium',
      testMatch: 'rendering.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'rendering-webkit',
      testMatch: 'rendering.spec.ts',
      use: { ...devices['iPhone 14'] },
    },
    // Lightweight WebKit coverage: smoke tests only.
    {
      name: 'demo-mobile-webkit',
      testMatch: ['configurator.spec.ts', 'preview.spec.ts', 'export.spec.ts', 'share.spec.ts'],
      grep: /@smoke/,
      use: { ...devices['iPhone 14'], baseURL: demo },
    },
  ],
  webServer: [
    {
      command: `npm run build && npm run preview -- --port ${PRODUCTION_PORT} --strictPort`,
      url: production,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npm run build:demo && npm run preview:demo -- --port ${DEMO_PORT} --strictPort`,
      url: demo,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
