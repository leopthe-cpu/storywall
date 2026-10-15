import { test, expect } from '@playwright/test';
import { useAccount, newStoryButton, ACCOUNTS, openDraftsList, waitForDraft, deleteRecentDrafts } from './helpers.js';

// AI Generate, as the admin account `leopteh` (admins are premium; the
// normal test account can't run it). It makes one draft there and deletes
// it again (only drafts saved in the last hours that contain KEPT).
// OFF by default: every run uses paid AI (story structure + about 3 pictures)
// and leaves the generated picture files in storage (deleting a draft doesn't
// remove them). Turn on with SW_RUN_GENERATE=1.
useAccount('admin');
test.describe.configure({ mode: 'serial' });
test.skip(process.env.SW_RUN_GENERATE !== '1', 'Generate costs AI credits: set SW_RUN_GENERATE=1 to run it');

// Generate keeps the user's own sentences word for word (it never rewrites
// them), so this phrase finds the drafts it made for clean-up.
const KEPT = 'rebuilt our onboarding flow';
const notes = `Last year I led a small team that ${KEPT}. Sign-ups were dropping at the second step. ` +
  'We interviewed ten users, removed two screens and added a progress bar. Completion went up by a third in a month.';

async function cleanUp(page) {
  await page.goto('/create');
  await openDraftsList(page);
  await deleteRecentDrafts(page, KEPT);
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await cleanUp(page);
  await page.close();
});

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  await cleanUp(page);
  await page.close();
});

test('Generate turns notes into cards with the same words and saves a draft', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto(`/${ACCOUNTS.admin.username}`);
  await newStoryButton(page).click();
  await page.getByRole('button', { name: /^Generate/ }).click();
  await expect(page).toHaveURL(/\/create/);

  const generate = page.getByRole('button', { name: 'Generate →' });
  await expect(generate).toBeDisabled();
  await page.getByPlaceholder('Write your story here...').fill(notes);
  await expect(generate).toBeEnabled();
  await generate.click();

  // Progress ("Structuring your story…", pictures…) until it's done.
  const progress = page.getByRole('status', { name: 'Loading' });
  await expect(progress).toBeVisible({ timeout: 20_000 });
  await expect(progress).toHaveCount(0, { timeout: 240_000 });

  // Several cards; the user's sentences are on them unchanged.
  await expect(page.getByText(/^1\/([2-9]|\d\d)$/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Notes' })).toBeVisible();
  for (const sentence of ['Sign-ups were dropping at the second step.', 'Completion went up by a third in a month.']) {
    await expect(page.getByText(sentence).first()).toBeAttached();
  }

  await openDraftsList(page);
  await waitForDraft(page, KEPT, { recent: true });
});
