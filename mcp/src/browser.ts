// The browser the server owns.
//
// It is launched **headful**, on purpose: the person is watching the edits land, and
// that is the feature. It runs on a **profile of its own** — a directory of ours, not
// the person's everyday browser — so their real profile is untouched and the
// publishing sign-in has a home of its own that lasts the session and no longer.
//
// It is the person's **own Chrome** by default, and that is not a detail. macOS grants
// Screen Recording per *application bundle*, and the Chromium Playwright downloads is
// a bundle of its own — "Google Chrome for Testing" — which the person will not find
// in System Settings to grant, so the picker never opens and the recording is
// impossible. Opening the Chrome they already have makes the app's own capture work,
// because the grant they gave Chrome covers the window we open: it is the same
// application.
//
// The page is opened with the flag that asks for the automation surface. Nothing else
// about the app changes: it is a normal browser on DemoClip.

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';

/** Which browser was opened, and whether the system can grant it the screen. */
export interface BrowserIdentity {
  /** What to call it when telling the person. */
  readonly label: string;
  /**
   * True when the system treats it as an application it can grant Screen Recording
   * to. Only macOS asks that, and only about a bundle it recognises.
   */
  readonly grantable: boolean;
}

export interface OpenedApp {
  readonly page: Page;
  readonly browser: BrowserIdentity;
  readonly close: () => Promise<void>;
}

export interface LaunchOptions {
  /** Headless is for the server's own checks only; a session for a person is headful. */
  readonly headless?: boolean;
  /** The browser to launch, when the person keeps it somewhere unusual. */
  readonly executablePath?: string;
  /**
   * Force a browser channel. An explicit `null` means the Chromium Playwright ships;
   * left out, a headful session opens Chrome and a headless check uses the bundled one.
   */
  readonly channel?: 'chrome' | 'msedge' | 'chromium' | null;
}

const LABELS: Readonly<Record<string, string>> = {
  chrome: 'Google Chrome',
  msedge: 'Microsoft Edge',
  chromium: 'Chromium',
};

const BUNDLED: BrowserIdentity = { label: 'Chromium', grantable: false };

/** Open the app, in a browser of the person's, on the page that asked to be driven. */
export async function openApp(origin: string, options: LaunchOptions = {}): Promise<OpenedApp> {
  const profile = await mkdtemp(join(tmpdir(), 'democlip-profile-'));
  const { context, browser } = await launch(profile, options);
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(`${origin}/?agent=1`, { waitUntil: 'domcontentloaded' });
    return { page, browser, close: () => context.close() };
  } catch (error) {
    await context.close().catch(() => {});
    throw error;
  }
}

async function launch(
  profile: string,
  options: LaunchOptions,
): Promise<{ context: BrowserContext; browser: BrowserIdentity }> {
  const common = {
    headless: options.headless ?? false,
    viewport: null,
    args: ['--no-first-run', '--no-default-browser-check'],
  };

  if (options.executablePath) {
    const context = await chromium.launchPersistentContext(profile, {
      ...common,
      executablePath: options.executablePath,
    });
    return { context, browser: { label: options.executablePath, grantable: true } };
  }

  // A check runs headless and wants the browser we pin. A session for a person wants
  // the browser they can grant the screen to, so Chrome is the default.
  const asked = 'channel' in options;
  const channel = asked ? options.channel : (common.headless ? null : 'chrome');

  if (!channel) {
    const context = await chromium.launchPersistentContext(profile, common);
    return { context, browser: BUNDLED };
  }

  try {
    const context = await chromium.launchPersistentContext(profile, { ...common, channel });
    return { context, browser: { label: LABELS[channel] ?? channel, grantable: true } };
  } catch (error) {
    // A channel the caller asked for is their choice, and its failure is theirs to see.
    // A default may fall back — and the browser it fell back to says why, later.
    if (asked) throw error;
    const context = await chromium.launchPersistentContext(profile, common);
    return { context, browser: BUNDLED };
  }
}
