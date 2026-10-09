import { test, expect } from '@playwright/test';
import { ACCOUNTS, useAccount, visitorPage } from './helpers.js';

// Screenshot comparisons of key screens (phone and desktop). The reference
// pictures were taken on the live Base44 app; on the new app every
// difference beyond a small tolerance fails. Only pages whose content is
// stable are used: `leo` is a test account the tests always restore, while
// Oz's own wall changes whenever he posts. Update the pictures with
// `npx playwright test e2e/screens.spec.js --update-snapshots` (only on
// purpose, after checking the difference).

// "Reduce motion" (an OS/browser setting the app respects): the landing
// headline appears fully typed and its card stack stays still.
test.use({ contextOptions: { reducedMotion: 'reduce' } });

// Every picture on the page has finished loading or failed (else a
// half-loaded photo makes two shots of the same page differ). Failed is
// allowed: e.g. the link icons come from Google, which a test machine's
// network may block. Compare pictures taken on the same kind of machine.
async function picturesLoaded(page) {
  await expect.poll(() => page.evaluate(() =>
    [...document.images].every((img) => img.complete)), { timeout: 20_000 }).toBe(true);
}

test.describe('signed out', () => {
  test('landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Claim your wall' })).toBeVisible();
    await picturesLoaded(page);
    await expect(page).toHaveScreenshot('landing.png');
  });

  test('sign-in page', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await picturesLoaded(page);
    await expect(page).toHaveScreenshot('signin.png');
  });

  test('sign-up page with a claimed name', async ({ page }) => {
    await page.goto('/signup?username=zz-free-name-4821');
    await expect(page.getByRole('heading', { name: 'Claim your wall' })).toBeVisible();
    await picturesLoaded(page);
    await expect(page).toHaveScreenshot('signup.png');
  });

  test('unclaimed username', async ({ page }) => {
    await page.goto('/zz-no-such-user-123');
    await expect(page.getByRole('heading', { name: "This wall isn't claimed yet" })).toBeVisible();
    await picturesLoaded(page);
    await expect(page).toHaveScreenshot('unclaimed.png');
  });
});

test.describe('signed in as leo', () => {
  useAccount('user');

  // Parked: this session's network blocks base44.app (profile photos) and
  // www.google.com (link icons), so the picture would show them broken.
  // Take its reference picture once those hosts are allowed.
  test.fixme("leo's wall seen by a visitor", async ({ browser }) => {
    const page = await visitorPage(browser);
    await page.goto(`/${ACCOUNTS.user.username}`);
    await expect(page.getByRole('heading', { level: 1, name: ACCOUNTS.user.name })).toBeVisible();
    await picturesLoaded(page);
    await expect(page).toHaveScreenshot('wall-leo-visitor.png');
    await page.context().close();
  });

  test('empty builder', async ({ page }) => {
    await page.goto('/create');
    await expect(page).toHaveTitle('Builder | storywall');
    await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await picturesLoaded(page);
    await expect(page).toHaveScreenshot('builder-empty.png');
  });
});
