// Keeping: the clip outlives the page, so a reload comes back to it.

import { expect, test } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';

test('a clip is kept and comes back after a reload', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 2 });
  await app.seed(takes);

  // The kept copy is written down as the clip changes, so wait for the store rather
  // than a fixed moment.
  await expect
    .poll(async () => page.evaluate(async () => {
      const databases = await indexedDB.databases();
      return databases.some(entry => entry.name === 'democlip');
    }))
    .toBe(true);

  await page.reload();
  await expect.poll(async () => app.clipLength()).toBeCloseTo(2, 1);
});
