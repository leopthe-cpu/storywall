import { test, expect } from '@playwright/test';
import { useAccount } from './helpers.js';

// The builder opens for a signed-in, onboarded user. Read-only: an untouched
// builder saves nothing (a draft is only created once a card has content,
// see persistDraft in StoryCreator.jsx).
useAccount('user');

test('the builder opens with an empty first card and its tools', async ({ page }) => {
  await page.goto('/create');
  await expect(page).toHaveTitle('Builder | storywall');
  await expect(page.getByText('1/1', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo' })).toBeDisabled();
  for (const tool of ['Text', 'Media', 'Theme', 'Templates', 'Drafts', 'Add card']) {
    await expect(page.getByRole('button', { name: tool, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /^Post/ })).toBeVisible();
});
