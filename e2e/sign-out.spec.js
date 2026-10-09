import { test, expect } from '@playwright/test';
import { ACCOUNTS, signIn } from './helpers.js';

// Signs in fresh (signing out of the shared saved session could end it for
// the other tests), so traces and screenshots are off: they'd record the
// typed password.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('log out returns to the landing page and the builder needs sign-in again', async ({ page }) => {
  const { email, password, username } = ACCOUNTS.user;
  test.skip(!email || !password, 'credentials for the user account are not set');
  await signIn(page, email, password);
  await expect(page).toHaveURL(new RegExp(`/${username}$`), { timeout: 30_000 });
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('button', { name: 'Claim your wall' })).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/create');
  await expect(page).toHaveURL(/\/signin/);
});
