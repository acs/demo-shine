// Cutting: two clicks bound a section, the scissors approves it, undo puts it back.

import { expect, test } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';

test('a section becomes a cut, and the one undo puts it back', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 4 });
  await app.seed(takes);
  await app.review();

  // The timeline is drawn over the thumbnail strip, so a click is measured there.
  const box = await page.locator('#thumbs').boundingBox();
  if (!box) throw new Error('no thumbnail strip');
  const y = box.y + box.height / 2;
  const clickAt = (fraction: number) => page.mouse.click(box.x + box.width * fraction, y);

  await clickAt(0.25);
  await clickAt(0.5);

  // The chip names the section a person just bounded. The app's markup carries two
  // elements with id `t-cut` (a duplicate id); this one is the chip in the header.
  await expect(page.locator('#t-cut-wrap #t-cut')).toContainText('CUT');

  // The scissors takes it out; the timeline closes up over it.
  await page.locator('[data-act="cut"]').click();

  await expect(page.locator('#cut-undo')).toBeVisible();
  await expect(page.locator('#t-clip')).toHaveText('3.00s');   // 1 s of the 4 removed

  // The one undo brings it back.
  await page.locator('#cut-undo').click();
  await expect(page.locator('#t-clip')).toHaveText('4.00s');
});
