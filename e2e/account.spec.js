import { test, expect } from '@playwright/test';
import { ACCOUNTS, useAccount } from './helpers.js';

// Signed-in account basics. Read-only: nothing here changes stored data.

for (const account of ['user', 'admin']) {
  test.describe(`signed in as ${account}`, () => {
    useAccount(account);
    const { username, name } = ACCOUNTS[account];

    test('the sign-in page sends you to your own wall', async ({ page }) => {
      await page.goto('/signin');
      await expect(page).toHaveURL(new RegExp(`/${username}$`), { timeout: 30_000 });
      await expect(page).toHaveTitle(`${name} | storywall`);
      await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    });

    test('your own wall has the owner controls and settings', async ({ page }) => {
      await page.goto(`/${username}`);
      await expect(page.getByRole('button', { name: 'Edit profile' })).toBeVisible();
      await page.getByRole('button', { name: 'Settings' }).click();
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
      await expect(page.getByText(`@${username}`, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /Archived stories/ })).toBeVisible();
      await expect(page.getByText('Public Profile', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
    });
  });
}
