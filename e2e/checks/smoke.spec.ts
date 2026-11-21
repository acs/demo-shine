// The app loads in a real browser and is ready.

import { expect, test } from '@playwright/test';
import { boot } from '../helpers/app.js';

test('the app boots and reads Ready', async ({ page }) => {
  await boot(page).goto();
  await expect(page.locator('#s-text')).toHaveText('Ready');
});
