import { defineConfig, devices } from '@playwright/test';

// Behaviour tests. They record how the live Base44 app behaves today (Phase 0.5
// of docs/migration-plan.md) and are later run unchanged against staging and
// production, so "works the same" is checked, not assumed.
// Point them at a site with BASE_URL (default: the live app).
const WRITES = /\.write\.spec\.js$/;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL || 'https://storywall.io',
    trace: 'retain-on-failure',
  },
  projects: [
    // Signs the test accounts in once; the other projects reuse the saved
    // sessions (e2e/auth.setup.js).
    { name: 'setup', testMatch: /auth\.setup\.js/, use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', testIgnore: WRITES, use: { ...devices['iPhone 13'], browserName: 'chromium' }, dependencies: ['setup'] },
    { name: 'desktop', testIgnore: WRITES, use: { ...devices['Desktop Chrome'] }, dependencies: ['setup'] },
    // Tests that change data (*.write.spec.js) all use the same test account,
    // so they run one at a time, after the read-only tests, phone then desktop.
    { name: 'phone-writes', testMatch: WRITES, workers: 1, use: { ...devices['iPhone 13'], browserName: 'chromium' }, dependencies: ['phone', 'desktop'] },
    { name: 'desktop-writes', testMatch: WRITES, workers: 1, use: { ...devices['Desktop Chrome'] }, dependencies: ['phone-writes'] },
  ],
});
