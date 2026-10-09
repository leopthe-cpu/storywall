import { test, expect } from '@playwright/test';
import {
  ACCOUNTS, useAccount, markerText, startStory, storyOnWall, storyMenu,
  deleteMarkedStories, visitorPage, waitForWrite, openDraftsList, deleteDrafts,
} from './helpers.js';

// Publish flow and wall management, as the test-only `leo` account. One
// story goes through publish → archive → restore → edit → delete. Anything
// marked "E2E" left over from a failed run is removed first and at the end.
useAccount('user');
test.describe.configure({ mode: 'serial' });

const { username } = ACCOUNTS.user;
const stamp = markerText();
const title = `${stamp} title`;
// Words the skills matcher recognises, so it suggests tags.
const body = `${stamp}. I ran user research interviews and data analysis to improve conversion.`;

async function cleanUp(page) {
  await deleteMarkedStories(page, username);
  await page.goto('/create');
  await openDraftsList(page);
  await deleteDrafts(page);
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

test('publish: suggested skills, a title, then the story is on the wall for everyone', async ({ page, browser }) => {
  await startStory(page, body);
  // The publish screen previews the card; the image export is admin-only.
  await expect(page.getByText(body, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Download card as image/ })).toHaveCount(0);

  // Skills: suggestions appear; none is picked for you.
  await expect(page.getByRole('button', { name: 'Regenerate suggestions' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Post →' }).last().click();
  await expect(page.getByText('Please select a skill')).toBeVisible();
  await page.getByRole('button', { name: 'Data Analysis', exact: true }).click();

  await page.getByPlaceholder('Give your story a title...').fill(title);
  await expect(page.getByText(`${title.length}/60`)).toBeVisible();
  await page.getByRole('button', { name: 'Post →' }).last().click();

  await expect(page).toHaveURL(new RegExp(`/${username}$`), { timeout: 30_000 });
  await expect(storyOnWall(page, stamp)).toBeVisible({ timeout: 30_000 });
  // Title above the card, skill tags below it (leo has no other stories).
  await expect(page.getByRole('heading', { level: 3, name: title })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Data Analysis', exact: true })).toBeVisible();

  const visitor = await visitorPage(browser);
  await visitor.goto(`/${username}`);
  await expect(visitor.getByText(body, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await visitor.context().close();
});

test('archive hides the story from the wall; restoring brings it back', async ({ page, browser }) => {
  await page.goto(`/${username}`);
  const archived = waitForWrite(page);
  await storyMenu(page, stamp, 'Archive');
  await expect(storyOnWall(page, stamp)).toHaveCount(0, { timeout: 15_000 });
  await archived;

  const visitor = await visitorPage(browser);
  await visitor.goto(`/${username}`);
  await expect(visitor.getByRole('heading', { level: 1, name: ACCOUNTS.user.name })).toBeVisible();
  await expect(visitor.getByText(body, { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Archived stories/ }).click();
  await expect(page.getByRole('heading', { name: 'Archived stories' })).toBeVisible();
  const row = page.locator('div')
    .filter({ has: page.getByRole('button', { name: 'Restore to profile' }) })
    .filter({ hasText: stamp })
    .last();
  await row.getByRole('button', { name: 'Restore to profile' }).click();
  await expect(row).toHaveCount(0, { timeout: 15_000 });

  await page.goto(`/${username}`);
  await expect(storyOnWall(page, stamp)).toBeVisible({ timeout: 30_000 });
  await visitor.reload();
  await expect(visitor.getByText(body, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await visitor.context().close();
});

test('edit reopens the story in the builder and re-posting keeps it on the wall', async ({ page }) => {
  await page.goto(`/${username}`);
  await storyMenu(page, stamp, 'Edit');
  await expect(page).toHaveURL(/\/create/);
  await expect(page.getByText(body, { exact: true }).first()).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Post →' }).first().click();
  // The existing title and skill come back on the publish screen.
  await expect(page.getByPlaceholder('Give your story a title...')).toHaveValue(title);
  await page.getByPlaceholder('Give your story a title...').fill(`${title} edited`);
  await page.getByRole('button', { name: 'Post →' }).last().click();
  await expect(page).toHaveURL(new RegExp(`/${username}$`), { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 3, name: `${title} edited` })).toBeVisible({ timeout: 30_000 });
  await expect(storyOnWall(page, stamp)).toHaveCount(1);
});

test('delete asks first, then removes the story', async ({ page, browser }) => {
  await page.goto(`/${username}`);
  await storyMenu(page, stamp, 'Delete');
  await expect(page.getByRole('heading', { name: 'Delete this story?' })).toBeVisible();
  await expect(page.getByText('This cannot be undone.')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(storyOnWall(page, stamp)).toBeVisible();

  await storyMenu(page, stamp, 'Delete');
  const deleted = waitForWrite(page, ['DELETE']);
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(storyOnWall(page, stamp)).toHaveCount(0, { timeout: 15_000 });
  await deleted;
  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit profile' })).toBeVisible({ timeout: 30_000 });
  await expect(storyOnWall(page, stamp)).toHaveCount(0);

  const visitor = await visitorPage(browser);
  await visitor.goto(`/${username}`);
  await expect(visitor.getByRole('heading', { level: 1, name: ACCOUNTS.user.name })).toBeVisible();
  await expect(visitor.getByText(body, { exact: true })).toHaveCount(0);
  await visitor.context().close();
});

test('when no skill matches, you tag your own and it shows on the wall', async ({ page }) => {
  const own = markerText();
  await startStory(page, `${own} zzq`);
  await expect(page.getByText('Or tag your own skills')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Try matching again' })).toBeVisible();
  await page.getByPlaceholder('Type a skill…').fill('Test Skill');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Test Skill', { exact: true })).toBeVisible();
  await page.getByPlaceholder('Give your story a title...').fill(`${own} title`);
  await page.getByRole('button', { name: 'Post →' }).last().click();
  await expect(page).toHaveURL(new RegExp(`/${username}$`), { timeout: 30_000 });
  await expect(storyOnWall(page, own)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Test Skill', exact: true })).toBeVisible();
  // Deleted by the clean-up after the last test.
});
