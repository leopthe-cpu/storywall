import { test as setup } from '@playwright/test';
import fs from 'node:fs';
import { ACCOUNTS, authFile, signIn } from './helpers.js';

// Signs each test account in ONCE and saves the session (browser storage) to
// e2e/.auth/<account>.json (gitignored: it holds a live sign-in token). The
// signed-in specs reuse it, so the password is typed here only.
// Traces and screenshots are off: they would record the typed password.
setup.use({ trace: 'off', screenshot: 'off', video: 'off' });

for (const account of Object.keys(ACCOUNTS)) {
  setup(`sign in as ${account}`, async ({ page }) => {
    const { email, password } = ACCOUNTS[account];
    fs.mkdirSync('e2e/.auth', { recursive: true });
    if (!email || !password) {
      // Credentials not set: save an empty session so the specs can load;
      // they skip themselves (see useAccount in helpers.js).
      fs.writeFileSync(authFile(account), JSON.stringify({ cookies: [], origins: [] }));
      return;
    }
    await signIn(page, email, password);
    await page.context().storageState({ path: authFile(account) });
  });
}
