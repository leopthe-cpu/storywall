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

// Every story a test creates contains this marker, so leftovers from a failed
// run can be found and removed by the next run.
export const MARKER = 'E2E';
export const markerText = () => `${MARKER} ${Date.now().toString(36)}`;

// Builder: start typing into the empty text box that clicking the Text tab
// adds to an empty card. The "Text" placeholder doesn't take clicks itself
// (pointer-events: none), so the double-click is forced through to the box.
export async function typeIntoNewTextBox(page, text) {
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await page.getByText('Text', { exact: true }).first().dblclick({ force: true });
  await page.keyboard.type(text);
}

// Builder: the Drafts list (Cards → Drafts), once it has loaded (the test
// account always has at least one draft of its own, older than the tests).
export async function openDraftsList(page) {
  await page.getByRole('button', { name: 'Cards', exact: true }).click();
  await page.getByRole('button', { name: 'Drafts', exact: true }).click();
  await expect(page.getByText(/^Saved /).first()).toBeVisible({ timeout: 20_000 });
}

// The Drafts list loads only when its tab opens, so to see a draft that was
// just autosaved, re-open the tab until it shows up.
export async function waitForDraft(page, text) {
  await expect(async () => {
    await page.getByRole('button', { name: 'Gallery', exact: true }).click();
    await page.getByRole('button', { name: 'Drafts', exact: true }).click();
    await expect(draftRow(page, text)).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 40_000 });
}

// One draft row in the Drafts list: the smallest block holding both its
// "Saved …" line and the given text. Blocks that also hold the panel's tabs
// are excluded, or the whole screen (canvas + list) would match.
export function draftRow(page, text) {
  return page.locator('div')
    .filter({ has: page.getByText(/^Saved /) })
    .filter({ hasNot: page.getByRole('button', { name: 'Drafts', exact: true }) })
    .filter({ hasText: text })
    .last();
}

// Builder: delete every draft whose cards contain `text` (the bin button is
// the row's last button; the first click asks, the second deletes).
export async function deleteDrafts(page, text = MARKER) {
  for (let i = 0; i < 10 && (await draftRow(page, text).count()); i++) {
    const row = draftRow(page, text);
    const before = await page.getByText(/^Saved /).count();
    await row.getByRole('button').last().click();
    await row.getByRole('button').last().click();
    await expect(page.getByText(/^Saved /)).toHaveCount(before - 1, { timeout: 15_000 });
  }
}
