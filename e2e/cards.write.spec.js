import { test, expect } from '@playwright/test';
import {
  ACCOUNTS, useAccount, openDraftsList, deleteRecentDrafts, deleteMarkedStories, visitorPage,
} from './helpers.js';

// Screenshot comparisons of rendered cards: the same two cards of the
// "Bold Poster — Photo" template (a text card and a photo card) in the
// editor, in the publish preview, and published on the wall. These must look
// the same in each place ("editor looks different from published" is the
// app's #1 bug class) and the same on the new app as on Base44.
// Runs as the test-only `leo` account; the story is deleted afterwards.
useAccount('user');
test.describe.configure({ mode: 'serial' });
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const TITLE_CARD_TEXT = 'THE LAST TAP';
const PHOTO_CARD_TEXT = 'Our booking flow had five screens';
const { username } = ACCOUNTS.user;

async function cleanUp(page) {
  await deleteMarkedStories(page, username, PHOTO_CARD_TEXT);
  await page.goto('/create');
  await openDraftsList(page);
  await deleteRecentDrafts(page, PHOTO_CARD_TEXT);
}

async function picturesLoaded(page) {
  await expect.poll(() => page.evaluate(() =>
    [...document.images].every((img) => img.complete)), { timeout: 20_000 }).toBe(true);
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

test('template cards: editor, publish preview and wall look as recorded', async ({ page }) => {
  await page.goto('/create');
  await page.getByRole('button', { name: 'Cards', exact: true }).click();
  await page.getByRole('button', { name: 'Templates', exact: true }).click();
  await page.getByText('Bold Poster — Photo', { exact: true }).click();
  await expect(page.getByText('1/6', { exact: true }).first()).toBeVisible();
  // Leave the Templates list (its highlight changes) for the plain Text tab.
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await picturesLoaded(page);
  await expect(page).toHaveScreenshot('editor-card1.png');
  await page.getByRole('button', { name: 'Next card' }).click();
  await expect(page.getByText('2/6', { exact: true }).first()).toBeVisible();
  await picturesLoaded(page);
  await expect(page).toHaveScreenshot('editor-card2.png');

  // Publish preview: the card itself (same carousel as on the wall; the
  // skills below it vary with the AI's suggestions).
  await page.getByRole('button', { name: 'Post →' }).first().click();
  await expect(page.getByPlaceholder('Give your story a title...')).toBeVisible();
  const skills = page.getByText('Skills', { exact: true }).locator('xpath=..');
  await expect(page.getByRole('button', { name: /Regenerate suggestions|Try matching again/ })).toBeVisible({ timeout: 30_000 });
  await picturesLoaded(page);
  await expect(page.locator('[data-card-item]').first()).toHaveScreenshot('preview-card1.png');

  // Publish with one skill, then the cards on the wall.
  if (await page.getByText('Or tag your own skills').isVisible()) {
    await page.getByPlaceholder('Type a skill…').fill('Test Skill');
    await page.keyboard.press('Enter');
  } else {
    await skills.getByRole('button').nth(1).click(); // first suggestion
  }
  await page.getByRole('button', { name: 'Post →' }).last().click();
  await expect(page).toHaveURL(new RegExp(`/${username}$`), { timeout: 30_000 });

  // The published story as a visitor sees it (no owner buttons on top).
  // leo's wall has only this story, so its cards are the page's cards.
  const visitor = await visitorPage(page.context().browser());
  await visitor.goto(`/${username}`);
  const cards = visitor.locator('[data-card-item]');
  await expect(cards.first()).toContainText(TITLE_CARD_TEXT, { timeout: 30_000 });
  await picturesLoaded(visitor);
  await expect(cards.first()).toHaveScreenshot('wall-card1.png');

  // Swipe left to card 2 (the arrows are desktop-only, hover-shown).
  const box = await cards.first().boundingBox();
  const y = box.y + box.height / 2;
  await visitor.mouse.move(box.x + box.width * 0.8, y);
  await visitor.mouse.down();
  await visitor.mouse.move(box.x + box.width * 0.2, y, { steps: 10 });
  await visitor.mouse.up();
  await visitor.mouse.move(1, 1); // off the card, so its hover arrows hide
  await expect.poll(async () => Math.round((await cards.nth(1).boundingBox()).x)).toBe(Math.round(box.x));
  await expect(cards.nth(1)).toContainText(PHOTO_CARD_TEXT);
  await picturesLoaded(visitor);
  await expect(cards.nth(1)).toHaveScreenshot('wall-card2.png');
  await visitor.context().close();
});
