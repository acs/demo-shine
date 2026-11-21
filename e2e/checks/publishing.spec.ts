// Publishing: the dialog's states, with the publishing service stood in for.
//
// A live sign-in round-trip is a person's check: it leaves the app for the
// authorization server and comes back. What is covered here is the dialog's own
// browser-facing behaviour — the sign-in view, and the error it shows when no
// handle is entered — with no network in reach.

import { expect, test } from '@playwright/test';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';

test('the publish dialog opens on sign-in, with no live round-trip', async ({ page }) => {
  // Nothing leaves the machine: the publishing service is out of reach.
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) return route.continue();
    return route.abort();
  });

  const app = boot(page);
  await app.goto();

  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.seed(takes);
  await app.review();

  await page.locator('#btn-exp').click();
  await page.locator('#exp-bluesky').click();

  await expect(page.locator('#pub-bd')).toBeVisible();
  await expect(page.locator('#pub-signin-view')).toBeVisible();
  await expect(page.locator('#pub-handle')).toBeVisible();
});

test('the dialog says what is missing when no handle is entered', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  const takes = await makeTakes(page, { width: 640, height: 360, seconds: 1 });
  await app.seed(takes);
  await app.review();

  await page.locator('#btn-exp').click();
  await page.locator('#exp-bluesky').click();
  await expect(page.locator('#pub-bd')).toBeVisible();

  // Sign in with nothing typed: the dialog says so, and goes nowhere.
  await page.locator('#pub-signin').click();
  await expect(page.locator('#pub-error')).toContainText('Enter your Bluesky handle');
});
