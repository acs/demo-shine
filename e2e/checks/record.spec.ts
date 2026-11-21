// The record flow on stand-in devices: a real take from the fake camera.
//
// The screen-share picker cannot be driven by a machine — `getDisplayMedia` needs a
// gesture and a browser pane — so the picker stays a check a person runs. Everything
// after a stream is handed back is covered in capture.spec.ts with a stand-in share;
// here the webcam comes from Chromium's fake device.

import { expect, test } from '@playwright/test';
import { boot } from '../helpers/app.js';

test('the webcam records a take on a stand-in device', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  await expect(page.locator('#webcam-btn')).toBeEnabled();
  await page.locator('#webcam-btn').click();
  await expect(page.locator('#s-text')).toContainText('Live');

  // Record a short take, then stop: the take lands in the clip.
  await page.locator('#rec-btn').click();
  await expect(page.locator('#s-text')).toHaveText('Recording');
  // The live timer ticks, which is the visible signal that the take is running.
  await expect(page.locator('#t-live-time')).not.toHaveText('00:00');
  await page.locator('#rec-btn').click();

  await expect.poll(() => app.clipLength(), { timeout: 10_000 }).toBeGreaterThan(0.2);
});
