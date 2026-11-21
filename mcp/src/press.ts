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

import type { Session } from './session.js';

/** The app's own Screen button, by the id its markup gives it. */
export const SCREEN_BUTTON = '#screen-btn';

export interface Pressed {
  readonly pressed: boolean;
  readonly reason?: string;
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
