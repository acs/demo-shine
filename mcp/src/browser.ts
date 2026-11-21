// The browser the server owns.
//
// It is launched **headful**, on purpose: the person is watching the edits land, and
// that is the feature. It runs on a **profile of its own** — a directory of ours, not
// the person's everyday browser — so their real profile is untouched and the
// publishing sign-in has a home of its own that lasts the session and no longer.
//
// The page is opened with the flag that asks for the automation surface. Nothing
// else about the app changes: it is a normal browser on DemoClip.

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';

export interface OpenedApp {
  readonly page: Page;
  readonly close: () => Promise<void>;
}

export interface LaunchOptions {
  /** Headless is for the server's own checks only; a session for a person is headful. */
  readonly headless?: boolean;
  /** The browser to launch, when the person keeps it somewhere unusual. */
  readonly executablePath?: string;
}

/** Open the app, in a browser of our own, on the page that asked to be driven. */
export async function openApp(origin: string, options: LaunchOptions = {}): Promise<OpenedApp> {
  const profile = await mkdtemp(join(tmpdir(), 'democlip-profile-'));
  const context: BrowserContext = await chromium.launchPersistentContext(profile, {
    headless: options.headless ?? false,
    viewport: null,
    args: ['--no-first-run', '--no-default-browser-check'],
    ...(options.executablePath ? { executablePath: options.executablePath } : {}),
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(`${origin}/?agent=1`, { waitUntil: 'domcontentloaded' });
  return { page, close: () => context.close() };
}
