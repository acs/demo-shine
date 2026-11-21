// Annotations: each kind is placed over a selected section through the real canvas.

import { expect, test, type Page } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';

// A 1×1 PNG: enough for the image kind to decode and place.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Bound a section on the timeline, so the kind's action is offered. */
async function section(page: Page): Promise<void> {
  const strip = await page.locator('#thumbs').boundingBox();
  if (!strip) throw new Error('no thumbnail strip');
  const y = strip.y + strip.height / 2;
  await page.mouse.click(strip.x + strip.width * 0.25, y);
  await page.mouse.click(strip.x + strip.width * 0.5, y);
}

test('an arrow is placed over a section and shown on the timeline lane', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 4 });
  await app.seed(takes);
  await app.review();
  await section(page);

  await page.locator('[data-act="add"][data-kind="arrow"]').click();

  // Draw the arrow across the picture.
  const preview = await page.locator('#preview').boundingBox();
  if (!preview) throw new Error('no preview');
  const at = (fx: number, fy: number) => ({ x: preview.x + preview.width * fx, y: preview.y + preview.height * fy });
  const from = at(0.3, 0.3);
  const to = at(0.7, 0.7);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();

  // The annotation lane shows where the annotation is.
  await expect(page.locator('#tl-annots > *')).not.toHaveCount(0);
});

test('an image is placed over a section', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 4 });
  await app.seed(takes);
  await app.review();
  await section(page);

  const chooser = page.waitForEvent('filechooser');
  await page.locator('[data-act="add"][data-kind="image"]').click();
  const file = await chooser;
  await file.setFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG });

  await expect(page.locator('#tl-annots > *')).not.toHaveCount(0);
});

test('text is placed over a section', async ({ page }) => {
  const app = boot(page);
  await app.goto();
  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 4 });
  await app.seed(takes);
  await app.review();
  await section(page);

  // The app's own entry, not the browser's prompt: type a line and add it.
  await page.locator('[data-act="add"][data-kind="text"]').click();
  await page.locator('#text-entry-input').fill('Hello');
  await page.locator('#text-entry-add').click();

  await expect(page.locator('#tl-annots > *')).not.toHaveCount(0);
});
