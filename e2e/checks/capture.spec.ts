// The capture, once a share is handed back — where the recent regressions lived.
//
// The picker itself is never opened: `getDisplayMedia` needs a gesture and a pane.
// These checks stand in for what comes back from one and assert the app's handling.

import { expect, test } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { askedFor, installStandInShare } from '../helpers/stand-ins.js';

test('the capture asks for the cursor and the frame rate, and forces no pane', async ({ page }) => {
  await installStandInShare(page);
  const app = boot(page);
  await app.goto();

  await page.locator('#screen-btn').click();
  await expect.poll(async () => (await askedFor(page)) !== null).toBe(true);

  const asked = await askedFor(page);
  expect(JSON.stringify(asked)).toContain('"cursor":"always"');
  expect(JSON.stringify(asked)).toContain('"frameRate"');
  // The picker is left to open on whatever pane it likes: `displaySurface` used to
  // point it at the screen, which works against recording a tab or a window.
  expect(JSON.stringify(asked)).not.toContain('displaySurface');
});

test('a silent share is reported', async ({ page }) => {
  await installStandInShare(page, { silent: true });
  const app = boot(page);
  await app.goto();

  await page.locator('#screen-btn').click();
  await expect(page.locator('#s-text')).toContainText('no audio shared');
});

test('the capture is sized from the picture, not from the track settings', async ({ page }) => {
  // A display track reports the display's size until a tab's first frame lands.
  await installStandInShare(page, {
    width: 1280,
    height: 720,
    settingsSize: { width: 1920, height: 1080 },
  });
  const app = boot(page);
  await app.goto();

  await page.locator('#screen-btn').click();
  await expect(page.locator('#s-text')).toContainText('1280×720');
  await expect(page.locator('#s-text')).not.toContainText('1920×1080');
});
