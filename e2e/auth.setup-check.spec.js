import { test, expect } from '@playwright/test';

// Signs in with the test accounts stored as environment variables
// (SW_ADMIN_* = admin + premium account, SW_USER_* = normal account).
// Values never appear in the repo. WARNING: on failure Playwright's
// error-context.md and trace record what was typed into the form, password
// included. Traces and screenshots are therefore off here; test-results/ is
// gitignored. Never print or share it, and delete it after a failed auth run.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const accounts = [
  ['admin', process.env.SW_ADMIN_EMAIL, process.env.SW_ADMIN_PASSWORD],
  ['user', process.env.SW_USER_EMAIL, process.env.SW_USER_PASSWORD],
];

for (const [label, email, password] of accounts) {
  test(`${label} account can sign in`, async ({ page }) => {
    test.skip(!email || !password, `SW_${label.toUpperCase()}_* not set`);
    await page.goto('/signin');
    await page.getByRole('textbox', { name: /email/i }).fill(email);
    await page.getByRole('textbox', { name: /password/i }).or(page.locator('input[type="password"]')).first().fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).not.toHaveURL(/\/signin/, { timeout: 30_000 });
  });
}
