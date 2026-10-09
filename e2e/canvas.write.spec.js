import { test, expect } from '@playwright/test';
import {
  useAccount, markerText, typeIntoNewTextBox, openDraftsList, waitForDraft, draftRow,
  deleteDrafts, deleteRecentDrafts,
} from './helpers.js';

// Moving, resizing, cropping and zooming on the builder's card, and that it
// all survives saving and reopening the draft. Runs as the test-only `leo`
// account; drafts are cleaned up. The photo comes from the "Bold Poster —
// Photo" template, so nothing is uploaded.
// The handles have no labels or text: they're found by their mouse cursor
// (corners: nwse/nesw-resize, edges: ns/ew-resize), the same components the
// new app keeps.
useAccount('user');
test.describe.configure({ mode: 'serial' });

// Text from the photo template's second card (the one with the photo).
const PHOTO_CARD_TEXT = 'Our booking flow had five screens';

async function cleanUp(page) {
  await page.goto('/create');
  await openDraftsList(page);
  await deleteDrafts(page);
  await deleteRecentDrafts(page, PHOTO_CARD_TEXT);
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

// Drag with the mouse from one point to another, in small steps.
async function drag(page, from, dx, dy) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 12 });
  await page.mouse.up();
}

// Autosave runs a few seconds after the last change. Start this just before
// the last change and await it after: it resolves when the story is saved.
function nextStorySave(page) {
  return page.waitForResponse(
    (res) => ['POST', 'PUT', 'PATCH'].includes(res.request().method()) && /post/i.test(res.url()),
    { timeout: 40_000 },
  );
}

const centre = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

// Reopens the draft containing `text` in a fresh builder, retrying until the
// check passes (autosave runs a few seconds after the last change).
async function reopenAndCheck(page, text, { recent = false } = {}, check) {
  await expect(async () => {
    await page.goto('/create');
    await openDraftsList(page);
    await waitForDraft(page, text, { recent });
    await draftRow(page, text, { recent }).getByText(/^Saved /).click();
    await check();
  }).toPass({ timeout: 60_000 });
}

test('text: dragging moves it, the edge handle narrows it, and both are kept', async ({ page }) => {
  const text = markerText();
  await typeIntoNewTextBox(page, text);
  // Finish typing: click an empty part of the card, below the text.
  const typed = await page.getByText(text, { exact: true }).first().boundingBox();
  await page.mouse.click(typed.x + 10, typed.y + typed.height + 80);
  const box0 = await page.getByText(text, { exact: true }).first().boundingBox();

  // Drag it down. (Dragging, unlike a tap, doesn't start text editing, and
  // leaves the box selected with its handles showing.)
  await drag(page, centre(box0), 0, 60);
  const box1 = await page.getByText(text, { exact: true }).first().boundingBox();
  expect(box1.y - box0.y).toBeGreaterThan(40);
  expect(Math.abs(box1.x - box0.x)).toBeLessThan(5);

  // The right-edge handle makes the box narrower.
  const edges = page.locator('[style*="cursor: ew-resize"]');
  await expect(edges).toHaveCount(2);
  const right = (await edges.nth(0).boundingBox()).x > (await edges.nth(1).boundingBox()).x ? edges.nth(0) : edges.nth(1);
  const rightBox0 = await right.boundingBox();
  const saved = nextStorySave(page);
  await drag(page, centre(rightBox0), -50, 0);
  const rightBox1 = await right.boundingBox();
  expect(rightBox0.x - rightBox1.x).toBeGreaterThan(30);
  await saved;

  await reopenAndCheck(page, text, {}, async () => {
    const box = await page.getByText(text, { exact: true }).first().boundingBox({ timeout: 10_000 });
    expect(Math.abs(box.y - box1.y)).toBeLessThan(4);
    expect(Math.abs(box.x - box1.x)).toBeLessThan(4);
    expect(box.width).toBeLessThan(box1.width + 1);
  });
});

test('photo: corner resize keeps the opposite corner, edge crops, zoom; all kept', async ({ page }) => {
  await page.getByRole('button', { name: 'Cards', exact: true }).click();
  await page.getByRole('button', { name: 'Templates', exact: true }).click();
  await page.getByText('Bold Poster — Photo', { exact: true }).click();
  await expect(page.getByText('1/6', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Next card' }).click();
  await expect(page.getByText('2/6', { exact: true }).first()).toBeVisible();

  // Select the photo: click the card's upper part (the text sits lower).
  // Open Media → Sizing first: switching panel tabs drops the selection.
  const card = await page.locator('img').first().boundingBox();
  const selectPhoto = async () => {
    await page.getByRole('button', { name: 'Media', exact: true }).click();
    await page.getByRole('button', { name: 'Sizing', exact: true }).click();
    await page.mouse.click(card.x + card.width / 2, card.y + card.height * 0.2);
    await expect(page.locator('[style*="cursor: nwse-resize"]')).toHaveCount(2);
  };
  await selectPhoto();

  const corners = page.locator('[style*="cursor: nwse-resize"]'); // top-left, bottom-right
  const topLeft0 = await corners.first().boundingBox();
  const bottomRight0 = await corners.last().boundingBox();
  await drag(page, centre(bottomRight0), -70, -70);
  const topLeft1 = await corners.first().boundingBox();
  const bottomRight1 = await corners.last().boundingBox();
  // Figma/Canva behaviour: the opposite (top-left) corner stays put.
  expect(Math.abs(topLeft1.x - topLeft0.x)).toBeLessThan(3);
  expect(Math.abs(topLeft1.y - topLeft0.y)).toBeLessThan(3);
  expect(bottomRight0.x - bottomRight1.x).toBeGreaterThan(40);

  // An edge handle crops: drag the right edge in.
  const edges = page.locator('[style*="cursor: ew-resize"]');
  const right = (await edges.nth(0).boundingBox()).x > (await edges.nth(1).boundingBox()).x ? edges.nth(0) : edges.nth(1);
  const right0 = await right.boundingBox();
  await drag(page, centre(right0), -40, 0);
  const right1 = await right.boundingBox();
  expect(right0.x - right1.x).toBeGreaterThan(25);

  // Zoom (the Media → Sizing panel is already open).
  await expect(page.getByText('Zoom: 100%')).toBeVisible();
  const saved = nextStorySave(page);
  // Keyboard: End jumps the slider to its maximum, 200%.
  await page.getByRole('slider', { name: 'Zoom' }).focus();
  await page.keyboard.press('End');
  await expect(page.getByText('Zoom: 200%')).toBeVisible();
  await saved;

  const after = { topLeft: topLeft1, right: await right.boundingBox() };
  await reopenAndCheck(page, PHOTO_CARD_TEXT, { recent: true }, async () => {
    await page.getByRole('button', { name: 'Next card' }).click();
    await expect(page.getByText('2/6', { exact: true }).first()).toBeVisible();
    await selectPhoto();
    const tl = await page.locator('[style*="cursor: nwse-resize"]').first().boundingBox();
    expect(Math.abs(tl.x - after.topLeft.x)).toBeLessThan(4);
    expect(Math.abs(tl.y - after.topLeft.y)).toBeLessThan(4);
    const e = page.locator('[style*="cursor: ew-resize"]');
    const rx = Math.max((await e.nth(0).boundingBox()).x, (await e.nth(1).boundingBox()).x);
    expect(Math.abs(rx - after.right.x)).toBeLessThan(4);
    await expect(page.getByText('Zoom: 200%')).toBeVisible({ timeout: 3_000 });
  });
});
