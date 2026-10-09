import { test, expect } from '@playwright/test';
import { useAccount, markerText, typeIntoNewTextBox, openDraftsList, waitForDraft, draftRow, deleteDrafts, deleteRecentDrafts } from './helpers.js';

// Builder flows that save drafts. Run as the test-only `leo` account; every
// draft they make carries the E2E marker and is deleted at the end (and any
// leftover from an earlier failed run is deleted first).
useAccount('user');
test.describe.configure({ mode: 'serial' });

// A sentence from the "Bold Poster" template's first card body.
const TEMPLATE_TEXT = 'Our booking flow had five screens';

async function cleanUp(page) {
  await page.goto('/create');
  await openDraftsList(page);
  await deleteDrafts(page);
  await deleteRecentDrafts(page, TEMPLATE_TEXT);
}

// A story made from a template is autosaved a few seconds later, or when the
// page closes. Wait for that save, leave the builder, then delete it; else
// the save on close can land after the clean-up and leave a draft behind.
async function finishTemplateTest(page) {
  await page.getByRole('button', { name: 'Cards', exact: true }).click();
  await page.getByRole('button', { name: 'Drafts', exact: true }).click();
  await waitForDraft(page, TEMPLATE_TEXT, { recent: true });
  await page.goto('/');
  await cleanUp(page);
}

test.beforeEach(async ({ page }) => {
  await cleanUp(page);
  await page.goto('/create');
});

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  await cleanUp(page);
  await page.close();
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

test('a template fills an empty builder with its cards', async ({ page }) => {
  await page.getByRole('button', { name: 'Cards', exact: true }).click();
  await page.getByRole('button', { name: 'Templates', exact: true }).click();
  await page.getByText('Bold Poster', { exact: true }).click();
  await expect(page.getByText('1/5', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next card' })).toBeEnabled();
  await page.getByRole('button', { name: 'Next card' }).click();
  await expect(page.getByText('2/5', { exact: true }).first()).toBeVisible();
  await finishTemplateTest(page);
});

test('a template over your story saves your story first and starts a new one', async ({ page }) => {
  const text = markerText();
  await typeIntoNewTextBox(page, text);
  // Straight away, before autosave runs, so the edits are still unsaved.
  // (No "Replace this story?" question: TemplateConfirmModal isn't used.)
  await page.getByRole('button', { name: 'Cards', exact: true }).click();
  await page.getByRole('button', { name: 'Templates', exact: true }).click();
  await page.getByText('Bold Poster', { exact: true }).click();

  await expect(page.getByText('1/5', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(text, { exact: true })).toHaveCount(0);

  // Your story is a draft of its own, still with your text; the template
  // becomes a separate new draft (it used to overwrite yours).
  await page.getByRole('button', { name: 'Drafts', exact: true }).click();
  await waitForDraft(page, text);
  await waitForDraft(page, TEMPLATE_TEXT, { recent: true });
  await expect(draftRow(page, text)).not.toContainText(TEMPLATE_TEXT);
  await finishTemplateTest(page);
});
