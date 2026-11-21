// The boot helper: load the real app, wait for it to be ready, seed a clip.
//
// It changes no application code. A check reaches the app through the dev server's
// own module URLs — `/src/session.js` is the same module instance main.ts imports —
// exactly as a browser would, so no test hook is added to the app.
//
// The imports go through `e2e/support/app-hooks.ts`, which Vite serves and rewrites
// to the URLs the app loaded: importing `/src/session.js` here directly would make a
// second instance the app's views never see.

import { expect, type Page } from '@playwright/test';
import type { FixtureTake } from '../fixtures/takes.js';

interface PageWindow {
  __e2eTakes?: Array<{ blob: Blob; seconds: number }>;
}

export interface Booted {
  /** Navigate to "/" and wait until the status chip reads Ready. */
  goto(): Promise<void>;
  /** Clear the clip, so no check inherits state. */
  clear(): Promise<void>;
  /** Clear the clip and add the given takes, through the app's own module. */
  seed(takes: FixtureTake[]): Promise<void>;
  /** The clip's length in seconds, read from the app's own model. */
  clipLength(): Promise<number>;
  /** Put the app in the review phase and load the first take, so editing is live. */
  review(): Promise<void>;
}

export function boot(page: Page): Booted {
  return {
    async goto() {
      await page.goto('/');
      // A person-visible signal, not a fixed timeout: the chip says the app is up.
      await expect(page.locator('#s-text')).toHaveText('Ready');
    },

    async clear() {
      await page.evaluate(async () => {
        const { session } = await import('/e2e/support/app-hooks.ts');
        session.clip.clear();
      });
    },

    async seed(takes) {
      await page.evaluate(async (indices) => {
        const { session } = await import('/e2e/support/app-hooks.ts');
        session.clip.clear();
        const store = (window as unknown as PageWindow).__e2eTakes ?? [];
        for (const index of indices) {
          const take = store[index];
          if (take) session.clip.addTake(take.blob, take.seconds);
        }
      }, takes.map(take => take.index));
    },

    async clipLength() {
      return page.evaluate(async () => {
        const { session } = await import('/e2e/support/app-hooks.ts');
        return session.clip.total();
      });
    },

    async review() {
      await page.evaluate(async () => {
        const { setPhase, openReview } = await import('/e2e/support/app-hooks.ts');
        setPhase('review');
        await openReview(0, 0);
      });
      // openReview builds the strip in the background; wait for the first cell.
      await expect(page.locator('#thumbs canvas').first()).toBeVisible();
    },
  };
}
