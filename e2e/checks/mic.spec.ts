// The microphone meter follows the voice: the one sign that the microphone is heard.
//
// A browser strict about autoplay hands an AudioContext back suspended, and the meter
// is built after `getUserMedia` resolved — outside the click that asked for the
// microphone. A suspended context feeds its analyser nothing, so the bars sit on the
// floor while the person is talking into a microphone that records perfectly well:
// the app says the mic is not heard when it is. The stand-in gives every context that
// suspended start, which the suite's Chromium does not.

import { expect, test, type Page } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { installSuspendedAudio } from '../helpers/stand-ins.js';

/**
 * Watch the meter for a few seconds and answer the loudest it got, in percent. The
 * bar is sampled frame by frame, as an eye would see it: a single reading can land
 * between the beeps of the stand-in microphone and say nothing.
 */
async function loudestBar(page: Page, ms = 5_000): Promise<number> {
  return page.evaluate(limit => new Promise<number>(resolve => {
    const fill = document.getElementById('vu-fill');
    const started = performance.now();
    let peak = 0;
    const look = () => {
      const value = Number.parseFloat(fill?.style.height ?? '') || 0;
      peak = Math.max(peak, value);
      if (peak > 10 || performance.now() - started > limit) resolve(peak);
      else requestAnimationFrame(look);
    };
    look();
  }), ms);
}

test('the meter rises with the voice, though its audio context comes up suspended', async ({ page }) => {
  await installSuspendedAudio(page);
  const app = boot(page);
  await app.goto();

  await expect(page.locator('#mic-btn')).toBeEnabled();
  await page.locator('#mic-btn').click();
  await expect(page.locator('#mic-btn')).toHaveAttribute('aria-pressed', 'true');

  // Chromium's stand-in microphone beeps, so the level rises and falls. The meter
  // only leaves the floor if its context was asked to run.
  expect(await loudestBar(page)).toBeGreaterThan(10);
});