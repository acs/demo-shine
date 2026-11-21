// The timeline: a clip built from fixture takes, without recording one.

import { expect, test } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';

test('a clip built from fixture takes shows a strip and the sum of the takes', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  const takes = await makeTakes(
    page,
    { width: 600, height: 400, seconds: 1.2 },
    { width: 1280, height: 720, seconds: 1.2 },
  );
  await app.seed(takes);
  await app.review();

  // The length is the sum of the takes, never a field beside them.
  expect(await app.clipLength()).toBeCloseTo(2.4, 2);
  await expect(page.locator('#t-clip')).toHaveText('2.40s');

  // The strip is built by seeking the element through the clip: 22 cells.
  await expect(page.locator('#thumbs canvas')).toHaveCount(22);
});
