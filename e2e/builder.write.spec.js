import { test, expect } from '@playwright/test';
import { useAccount, markerText, typeIntoNewTextBox, openDraftsList, waitForDraft, draftRow, deleteDrafts } from './helpers.js';

// Builder flows that save drafts. Run as the test-only `leo` account; every
// draft they make carries the E2E marker and is deleted at the end (and any
// leftover from an earlier failed run is deleted first).
useAccount('user');
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await page.goto('/create');
  await openDraftsList(page);
  await deleteDrafts(page);
  await page.goto('/create');
});

test('typed text autosaves as a draft, reopens from Drafts, and the draft can be deleted', async ({ page }) => {
  const text = markerText();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await typeIntoNewTextBox(page, text);
  await expect(page.getByText(text, { exact: true }).first()).toBeVisible();

  // Autosave runs a few seconds after the last change (4 s debounce).
  await openDraftsList(page);
  await waitForDraft(page, text);
  await expect(draftRow(page, text).getByText(/^Saved less than a minute ago$/)).toBeVisible();

  // A fresh builder starts empty; the draft brings the text back.
  await page.goto('/create');
  await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  await openDraftsList(page);
  // Clicking the row opens the draft (its "Saved …" line is a plain part of
  // the row; the thumbnails strip handles its own clicks).
  await draftRow(page, text).getByText(/^Saved /).click();
  await expect(page.getByText(text, { exact: true }).first()).toBeVisible({ timeout: 20_000 });

  await page.goto('/create');
  await openDraftsList(page);
  await deleteDrafts(page, text);
  await expect(draftRow(page, text)).toHaveCount(0);
  await page.reload();
  await openDraftsList(page);
  await expect(draftRow(page, text)).toHaveCount(0);
});
