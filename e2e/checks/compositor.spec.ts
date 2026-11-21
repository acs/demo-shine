// The compositor records the picture at its own size, not the display track's settings.
//
// A display track reports the display's size until a tab's first frame lands. The
// compositor used to size its canvas from those settings, so a 1280×720 picture whose
// track claimed 1920×1080 was recorded at 1920×1080. The canvas comes from the picture
// the app is showing, so the recorded take is 1280×720.

import { expect, test } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { installStandInShare } from '../helpers/stand-ins.js';
import { pageModule } from '../helpers/page-module.js';

const HOOKS = pageModule('e2e/support/app-hooks.ts');

test('the compositor records the picture at its own size', async ({ page }) => {
  await installStandInShare(page, {
    width: 640,
    height: 360,
    settingsSize: { width: 1920, height: 1080 },
  });
  const app = boot(page);
  await app.goto();

  // A webcam in the picture makes the compositor draw a canvas; without one the
  // screen is recorded raw and there is no canvas to size.
  await page.locator('#webcam-btn').click();
  await expect(page.locator('#s-text')).toContainText('Live');

  await page.locator('#screen-btn').click();
  await expect(page.locator('#s-text')).toContainText('Live');

  await page.locator('#rec-btn').click();
  await expect(page.locator('#s-text')).toHaveText('Recording');
  // The live timer ticks, which is the visible signal that the take is running.
  await expect(page.locator('#t-live-time')).not.toHaveText('00:00');
  await page.locator('#rec-btn').click();

  // The take lands when the probe has its length, a moment after the stop.
  await expect.poll(() => app.clipLength(), { timeout: 10_000 }).toBeGreaterThan(0.2);

  const size = await page.evaluate(async (url) => {
    const { session } = await import(/* @vite-ignore */ url);
    const take = session.clip.takes.at(0);
    if (!take) return null;
    const video = document.createElement('video');
    video.muted = true;
    video.src = take.url;
    await new Promise<void>(resolve => {
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
      setTimeout(resolve, 3000);
    });
    return { width: video.videoWidth, height: video.videoHeight };
  }, HOOKS);

  expect(size).toEqual({ width: 640, height: 360 });
});
