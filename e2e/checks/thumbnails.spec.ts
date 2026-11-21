// A thumbnail keeps the picture's shape and is fitted to its cell, not stretched.
//
// The strip's cells are not the picture's shape — a portrait region is an ordinary
// one — so the bitmap keeps the picture's aspect ratio and the stylesheet crops it
// to the cell (`object-fit: cover`). A stretched bitmap would show something the
// clip does not hold. This is what `verify-object-fit.html` was checking by hand.

import { expect, test } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';

test('a portrait picture keeps its shape in a cell and is cropped, not stretched', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  const takes = await makeTakes(page, { width: 360, height: 640, seconds: 1 });
  await app.seed(takes);
  await app.review();

  // The bitmap the strip draws is the picture's own shape: 360×640, long side 80.
  const cell = page.locator('#thumbs canvas').first();
  await expect(cell).toBeVisible();
  const bitmap = await cell.evaluate(c => ({ w: c.width, h: c.height }));
  expect(bitmap.h).toBeGreaterThan(bitmap.w);
  expect(bitmap.w / bitmap.h).toBeCloseTo(360 / 640, 2);

  // The stylesheet fits that bitmap to the cell by cropping, not by stretching it.
  const fit = await cell.evaluate(c => getComputedStyle(c).objectFit);
  expect(fit).toBe('cover');
});
