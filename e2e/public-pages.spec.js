import { test, expect } from '@playwright/test';

// Pages a visitor sees without signing in. Elements are found by role and
// visible text only (the Base44 version can't be changed to add test ids),
// so the same file runs against both the old and the new site.

test('landing page shows the hero and the claim button', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('storywall | stories > bullet points');
  await expect(page.getByRole('heading', { name: /You're more than\s+a job title\./ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Claim your wall' })).toBeVisible();
});

test('a public wall shows the owner and their stories', async ({ page }) => {
  await page.goto('/leopteh');
  await expect(page).toHaveTitle('Oz | storywall');
  await expect(page.getByRole('heading', { name: 'Oz' }).first()).toBeVisible();
  // Skill tags from published stories are rendered as buttons.
  await expect(page.getByRole('button', { name: 'Storytelling' })).toBeVisible();
});

test('an unclaimed username offers to claim it', async ({ page }) => {
  await page.goto('/zz-no-such-user-123');
  await expect(page).toHaveTitle('zz-no-such-user-123 | storywall');
  await expect(page.getByRole('heading', { name: "This wall isn't claimed yet" })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Claim storywall.io/zz-no-such-user-123' })).toBeVisible();
});

test('the builder requires sign-in', async ({ page }) => {
  await page.goto('/create');
  await expect(page).toHaveURL(/\/signin/);
  await expect(page).toHaveTitle('Sign In | storywall');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Forgot password?' })).toBeVisible();
});
