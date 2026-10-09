import { test, expect } from '@playwright/test';

// Test accounts on the site under test (see docs/migration-plan.md):
// - admin  = `leopteh`, admin + premium, real data: tests only READ with it.
// - user   = `leo`, test-only account (admin since 2026-10-09, so it can run
//            Generate): tests that write data use this one and clean up.
// - normal = an optional non-admin, non-premium account for the "locked for
//            normal users" checks; those tests skip while it isn't set.
// Credentials come from environment variables only; never hard-code them.
export const ACCOUNTS = {
  admin: { username: 'leopteh', name: 'Oz', email: process.env.SW_ADMIN_EMAIL, password: process.env.SW_ADMIN_PASSWORD },
  user: { username: 'leo', name: 'Leo', email: process.env.SW_USER_EMAIL, password: process.env.SW_USER_PASSWORD },
  normal: { email: process.env.SW_NORMAL_EMAIL, password: process.env.SW_NORMAL_PASSWORD },
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

// Base44 only. Sets the signed-in user's privacy directly, with the same
// request the Settings switch sends (base44.auth.updateMe). Needed for clean
// up: on Base44 a private wall shows "This profile is private" to its own
// owner too, so the switch can't be reached again from the UI.
// The new app will need its own version of this.
export async function setOwnPrivacyBase44(page, isPrivate) {
  const status = await page.evaluate(async (value) => {
    const appId = '6a161402f22a3ebcce243595';
    const res = await fetch(`/api/apps/${appId}/entities/User/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('base44_access_token')}`,
        'X-App-Id': appId,
      },
      body: JSON.stringify({ is_private: value }),
    });
    return res.status;
  }, isPrivate);
  expect(status, 'privacy update request').toBe(200);
}

// The privacy switch in the Settings panel (it has no label of its own).
export function privacySwitch(page) {
  return page.getByText('Anyone can view your profile').locator('xpath=../..').getByRole('button');
}

// A page for a signed-out visitor. browser.newPage() would inherit the spec's
// saved sign-in (storageState from test.use), so the session is emptied here.
export async function visitorPage(browser) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  return context.newPage();
}
