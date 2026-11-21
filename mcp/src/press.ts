// The one press the server delivers itself.
//
// Turning the screen source on opens the browser's own picker, and a browser only
// grants that to a **transient user activation**. A scripted call into the page does
// not carry one; a real input event does. So this single operation is delivered the
// way a hand would: a trusted click on the app's own Screen button, through the
// browser's input protocol. Everything else goes through the surface, where it
// belongs.
//
// It chooses nothing. What is actually shared is picked by the person, in the picker
// that then appears — which is the one thing about a recording that stays theirs.

import type { BrowserIdentity } from './browser.js';
import type { Session } from './session.js';

/** The app's own Screen button, by the id its markup gives it. */
export const SCREEN_BUTTON = '#screen-btn';

export interface Pressed {
  readonly pressed: boolean;
  readonly reason?: string;
}

/**
 * The reason the screen cannot be turned on here, or null when it can.
 *
 * macOS grants Screen Recording per *application bundle*. The Chromium Playwright
 * downloads is a bundle of its own — "Google Chrome for Testing" — which the person
 * will not find in System Settings to grant, so the picker never opens and the button
 * does nothing. Opening the Chrome they already have is the default precisely so this
 * cannot happen; this is what says so plainly when it did anyway.
 */
export function screenCaptureBlocked(browser: BrowserIdentity, platform: string): string | null {
  if (platform !== 'darwin' || browser.grantable) return null;
  return (
    `this session opened ${browser.label}, which macOS will not let you grant Screen Recording to — ` +
    'it is not a browser the system recognises, so the picker never opens. Install Google Chrome and ' +
    'start a new session: the grant you gave Chrome covers it, and what is shared is still yours to choose.'
  );
}

export async function pressScreenButton(session: Session): Promise<Pressed> {
  const button = session.page.locator(SCREEN_BUTTON);
  if (await button.count() === 0) {
    return { pressed: false, reason: 'the app has no Screen button to press' };
  }
  if (await button.isDisabled()) {
    return {
      pressed: false,
      reason: 'the Screen button is not available — this browser cannot share a screen, or a take is in flight',
    };
  }
  await button.click({ timeout: 10_000 });
  return { pressed: true };
}
