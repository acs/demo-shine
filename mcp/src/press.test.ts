import { describe, expect, it } from 'vitest';

import { screenCaptureBlocked } from './press.js';
import type { BrowserIdentity } from './browser.js';

// The rule that stops the server pressing a button that could never work: macOS grants
// Screen Recording per application bundle, so a browser it does not recognise cannot
// be granted it, and the picker never opens. It is a rule about a platform and a
// browser, so it is proved here rather than by opening a window.

const chrome: BrowserIdentity = { label: 'Google Chrome', grantable: true };
const bundled: BrowserIdentity = { label: 'Chromium', grantable: false };

describe('turning the screen source on', () => {
  it('is allowed on macOS in a browser the system can grant the screen to', () => {
    expect(screenCaptureBlocked(chrome, 'darwin')).toBeNull();
  });

  it('is refused on macOS in a browser it cannot, with a reason that says what to do', () => {
    const reason = screenCaptureBlocked(bundled, 'darwin');
    expect(reason).toBeTruthy();
    expect(reason).toContain('Chromium');
    expect(reason).toContain('Google Chrome');
    expect(reason).toContain('new session');
  });

  it('is never refused elsewhere — only macOS asks the question', () => {
    expect(screenCaptureBlocked(bundled, 'linux')).toBeNull();
    expect(screenCaptureBlocked(bundled, 'win32')).toBeNull();
  });
});
