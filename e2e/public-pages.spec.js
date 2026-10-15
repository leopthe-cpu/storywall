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

test.describe('claiming a username on the landing page', () => {
  test('a taken name is refused', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('textbox', { name: 'Username' }).fill('leopteh');
    await expect(page.getByText('storywall.io/leopteh is taken')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Claim your wall' })).toBeDisabled();
  });

  test('a reserved name is refused', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('textbox', { name: 'Username' }).fill('admin');
    await expect(page.getByText('That name is reserved')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Claim your wall' })).toBeDisabled();
  });

  test('a free name leads to sign-up with the name filled in', async ({ page }) => {
    // Only checks availability and opens the sign-up page; no account is made.
    const name = 'zz-free-name-4821';
    await page.goto('/');
    await page.getByRole('textbox', { name: 'Username' }).fill(name);
    await expect(page.getByText(`storywall.io/${name} is available`)).toBeVisible();
    await page.getByRole('button', { name: 'Claim your wall' }).click();
    await expect(page).toHaveURL(`/signup?username=${name}`);
    await expect(page).toHaveTitle('Sign Up | storywall');
    await expect(page.getByRole('heading', { name: 'Claim your wall' })).toBeVisible();
    await expect(page.getByText(`Create your account to make storywall.io/${name} yours.`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create account' })).toBeDisabled();
  });
});
