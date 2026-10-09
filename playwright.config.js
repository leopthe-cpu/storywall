import { defineConfig, devices } from '@playwright/test';

// Behaviour tests. They record how the live Base44 app behaves today (Phase 0.5
// of docs/migration-plan.md) and are later run unchanged against staging and
// production, so "works the same" is checked, not assumed.
// Point them at a site with BASE_URL (default: the live app).
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
    { name: 'phone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
});
