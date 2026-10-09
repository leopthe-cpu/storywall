import { test, expect } from '@playwright/test';

// Test accounts on the site under test (see docs/migration-plan.md):
// admin = admin + premium (`leopteh`), user = normal account (`leo`).
// Credentials come from environment variables only; never hard-code them.
export const ACCOUNTS = {
  admin: { username: 'leopteh', name: 'Oz', email: process.env.SW_ADMIN_EMAIL, password: process.env.SW_ADMIN_PASSWORD },
  user: { username: 'leo', name: 'Leo', email: process.env.SW_USER_EMAIL, password: process.env.SW_USER_PASSWORD },
};

export const authFile = (account) => `e2e/.auth/${account}.json`;

// Use at the top of a spec: run its tests signed in as `account`, reusing the
// session saved by auth.setup.js. Skips when that account isn't configured.
export function useAccount(account) {
  test.use({ storageState: authFile(account) });
  test.beforeEach(() => {
    const { email, password } = ACCOUNTS[account];
    test.skip(!email || !password, `credentials for the ${account} account are not set`);
  });
}

// Fills in and submits the sign-in form. Callers must keep traces/screenshots
// off (test.use({ trace: 'off', screenshot: 'off' })): they record the password.
export async function signIn(page, email, password) {
  await page.goto('/signin');
  await page.getByRole('textbox', { name: /email/i }).fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/signin/, { timeout: 30_000 });
}

// The round "+" (new story) button on the owner's own wall. It has no label
// or text in the Base44 version, so it's found as the last button on the
// page; the tests then check the "New story" sheet really opened.
export function newStoryButton(page) {
  return page.getByRole('button').last();
}
