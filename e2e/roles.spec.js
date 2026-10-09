import { test, expect } from '@playwright/test';
import { ACCOUNTS, useAccount, newStoryButton } from './helpers.js';

// What each kind of visitor can see: premium (AI Generate), admin-only tools
// (Prompt Test, "Download images") and owner-only controls.
// Read-only: menus are opened and checked, nothing is clicked inside them.

const adminWall = `/${ACCOUNTS.admin.username}`;

test.describe('visitor (signed out)', () => {
  test('sees no owner controls on a wall', async ({ page }) => {
    await page.goto(adminWall);
    await expect(page.getByRole('heading', { level: 1, name: ACCOUNTS.admin.name })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Share' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit profile' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Settings' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Story options' })).toHaveCount(0);
  });
});

test.describe('another signed-in user', () => {
  useAccount('user');

  test("sees no owner controls on someone else's wall", async ({ page }) => {
    await page.goto(adminWall);
    await expect(page.getByRole('heading', { level: 1, name: ACCOUNTS.admin.name })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit profile' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Story options' })).toHaveCount(0);
  });
});

test.describe('normal user', () => {
  useAccount('user');

  test('New story: Generate is locked (premium) and there is no Prompt Test', async ({ page }) => {
    await page.goto(`/${ACCOUNTS.user.username}`);
    await expect(page.getByRole('button', { name: 'Edit profile' })).toBeVisible({ timeout: 30_000 });
    await newStoryButton(page).click();
    await expect(page.getByRole('heading', { name: 'New story' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Write/ })).toBeEnabled();
    const generate = page.getByRole('button', { name: /^Generate/ });
    await expect(generate).toBeDisabled();
    await expect(generate).toContainText('Premium feature — upgrade to unlock');
    await expect(page.getByRole('button', { name: /^Prompt Test/ })).toHaveCount(0);
  });

  test('the Prompt Test page refuses a non-admin', async ({ page }) => {
    await page.goto('/prompt-test');
    await expect(page.getByText('Admin access required')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Prompt Test' })).toHaveCount(0);
  });
});

test.describe('admin (premium)', () => {
  useAccount('admin');

  test('New story: Generate is available and so is Prompt Test', async ({ page }) => {
    await page.goto(adminWall);
    await expect(page.getByRole('button', { name: 'Edit profile' })).toBeVisible();
    await newStoryButton(page).click();
    await expect(page.getByRole('heading', { name: 'New story' })).toBeVisible();
    const generate = page.getByRole('button', { name: /^Generate/ });
    await expect(generate).toBeEnabled();
    await expect(generate).toContainText('Write your story as notes, AI builds the carousel');
    await expect(page.getByRole('button', { name: /^Prompt Test/ })).toBeVisible();
  });

  test('the Prompt Test page opens', async ({ page }) => {
    await page.goto('/prompt-test');
    await expect(page.getByRole('heading', { name: 'Prompt Test' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Enter image prompt...' })).toBeVisible();
    // Disabled until a prompt is typed; nothing is generated here.
    await expect(page.getByRole('button', { name: 'Generate', exact: true })).toBeDisabled();
  });

  test('a story menu offers "Download images"', async ({ page }) => {
    await page.goto(adminWall);
    await page.getByRole('button', { name: 'Story options' }).first().click();
    for (const item of ['Edit', 'Archive', 'Download images', 'Delete']) {
      await expect(page.getByRole('button', { name: item, exact: true })).toBeVisible();
    }
  });
});
