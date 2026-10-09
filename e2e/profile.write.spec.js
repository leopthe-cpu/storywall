import { test, expect } from '@playwright/test';
import { ACCOUNTS, useAccount, setOwnPrivacyBase44, privacySwitch, visitorPage } from './helpers.js';

// Profile owner flows. These CHANGE data, so they run only as the test-only
// `leo` account, one at a time (the *.write.spec.js projects in
// playwright.config.js), and put every value back afterwards.
useAccount('user');
test.describe.configure({ mode: 'serial' });

const { username } = ACCOUNTS.user;

test('edit profile: changed fields show on the wall, then are put back', async ({ page, browser }) => {
  await page.goto(`/${username}`);
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await expect(page.getByRole('heading', { name: 'Edit Profile' })).toBeVisible();

  const fields = {
    headline: page.getByPlaceholder('e.g. Product Manager'),
    location: page.getByPlaceholder('e.g. Barcelona'),
    bio: page.getByPlaceholder('Write a short bio — what do you do and what drives you?'),
  };
  const original = {};
  for (const [key, field] of Object.entries(fields)) original[key] = await field.inputValue();

  const stamp = Date.now().toString(36);
  const changed = { headline: `Test headline ${stamp}`, location: `Test city ${stamp}`, bio: `Test bio ${stamp}` };
  try {
    for (const [key, field] of Object.entries(fields)) await field.fill(changed[key]);
    await expect(page.getByText(`${changed.bio.length}/200`)).toBeVisible();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Edit Profile' })).toHaveCount(0);
    // Some profile texts are rendered more than once (e.g. a measuring copy).
    for (const value of Object.values(changed)) await expect(page.getByText(value, { exact: true }).filter({ visible: true }).first()).toBeVisible();

    // A visitor sees the change too.
    const visitor = await visitorPage(browser);
    await visitor.goto(`/${username}`);
    for (const value of Object.values(changed)) await expect(visitor.getByText(value, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await visitor.context().close();
  } finally {
    await page.goto(`/${username}`);
    await page.getByRole('button', { name: 'Edit profile' }).click();
    for (const [key, field] of Object.entries(fields)) await field.fill(original[key]);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Edit Profile' })).toHaveCount(0);
  }
  await page.reload();
  for (const value of Object.values(original)) {
    if (value) await expect(page.getByText(value, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  }
});

test('links: an added link shows on the wall and can be removed', async ({ page }) => {
  const host = `test-${Date.now().toString(36)}.example.com`;
  await page.goto(`/${username}`);
  await page.getByRole('button', { name: 'Edit profile' }).click();
  try {
    await page.getByRole('button', { name: 'Add a link' }).click();
    await page.getByPlaceholder('e.g. linkedin.com/in/you').fill(host);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Edit Profile' })).toHaveCount(0);
    // Typed without https:// — the wall links to the https address.
    await expect(page.getByRole('link', { name: host })).toHaveAttribute('href', `https://${host}`);
  } finally {
    await page.goto(`/${username}`);
    await page.getByRole('button', { name: 'Edit profile' }).click();
    const row = page.getByText(host, { exact: true }).locator('xpath=..');
    if (await row.count()) {
      await row.getByRole('button').click();
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Edit Profile' })).toHaveCount(0);
    }
  }
  await page.reload();
  await expect(page.getByRole('link', { name: host })).toHaveCount(0);
});

test('private wall: everyone sees "This profile is private"; signed-in users can search', async ({ page, browser }) => {
  await page.goto(`/${username}`);
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByText('Public Profile', { exact: true })).toBeVisible();
  try {
    await privacySwitch(page).click();

    const privateHeading = (p) => p.getByRole('heading', { name: 'This profile is private' });
    const search = (p) => p.getByPlaceholder('Search profiles by name or username…');

    // Signed-out visitor: the page, but the search finds nobody.
    const visitor = await visitorPage(browser);
    await visitor.goto(`/${username}`);
    await expect(privateHeading(visitor)).toBeVisible();
    await expect(visitor.getByText(`@${username} has made their wall private. Explore other public walls instead.`)).toBeVisible();
    await expect(visitor.getByRole('heading', { name: ACCOUNTS.user.name })).toHaveCount(0);
    await search(visitor).fill('jody');
    await expect(visitor.getByText('No profiles found')).toBeVisible({ timeout: 20_000 });
    await visitor.context().close();

    // Another signed-in user: the search finds public walls and opens them.
    const otherContext = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const other = await otherContext.newPage();
    await other.goto(`/${username}`);
    await expect(privateHeading(other)).toBeVisible();
    await search(other).fill('jody');
    await other.getByRole('button', { name: /@jody/ }).click({ timeout: 20_000 });
    await expect(other).toHaveURL(/\/jody$/);
    await expect(other.getByRole('heading', { level: 1, name: 'Jody' })).toBeVisible();
    await otherContext.close();

    // Not checked: what the owner sees. Base44 locks the owner out (same
    // page, no Settings); the new app fixes that on purpose (decision 17).
  } finally {
    await setOwnPrivacyBase44(page, false);
  }
  const visitor = await visitorPage(browser);
  await visitor.goto(`/${username}`);
  await expect(visitor.getByRole('heading', { level: 1, name: ACCOUNTS.user.name })).toBeVisible();
  await visitor.context().close();
});
