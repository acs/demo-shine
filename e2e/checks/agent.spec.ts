// The automation surface: the app's own operations, driven the way the MCP server
// drives them, and **what a person sees** when a change lands.
//
// The gate is checked in both states, because "published only when the page asked" is
// the promise that keeps a normal page just the app. The recording half is driven with
// the stand-in share, so the app's handling of a share is covered; the real picker
// stays the user's session.

import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { boot } from '../helpers/app.js';
import { makeTakes } from '../fixtures/takes.js';
import { activationAtShare, askedFor, installStandInShare } from '../helpers/stand-ins.js';

interface SurfaceWindow {
  democlip?: Record<string, unknown>;
}

/**
 * Reach the surface in the page and call one of its operations — or read one of its
 * values, when the path names a property rather than a method.
 */
async function call<T>(page: Page, path: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(
    ({ path, args }) => {
      const surface = (globalThis as unknown as SurfaceWindow).democlip;
      if (!surface) throw new Error('the page has no automation surface');
      const parts = path.split('.');
      let owner: unknown = surface;
      for (const part of parts.slice(0, -1)) {
        owner = (owner as Record<string, unknown> | undefined)?.[part];
      }
      const value = (owner as Record<string, unknown> | undefined)?.[parts[parts.length - 1]];
      if (typeof value === 'function') {
        return (value as (...a: unknown[]) => unknown).apply(owner, args) as unknown;
      }
      if (value === undefined) throw new Error(`the app offers no ${path}`);
      return value;
    },
    { path, args },
  ) as Promise<T>;
}

const published = (page: Page): Promise<string> =>
  page.evaluate(() => typeof (globalThis as unknown as SurfaceWindow).democlip);

/** Seed one four-second take and put the app in the review. */
async function reviewed(page: Page): Promise<void> {
  const app = boot(page);
  await app.gotoAgent();
  const takes = await makeTakes(page, { width: 1280, height: 720, seconds: 4 });
  await app.seed(takes);
  await app.review();
}

test('the surface is published on a page that asked, and on no other', async ({ page }) => {
  const app = boot(page);

  await app.goto();
  expect(await published(page)).toBe('undefined');
  // The badge is the visible half of the same gate, so it is absent too — not merely
  // hidden behind a class that a stray rule could reveal.
  await expect(page.locator('#agent-chip')).toBeHidden();

  await app.gotoAgent();
  expect(await published(page)).toBe('object');

  // And the page says so, in the header's own chip family, beside the status chip.
  const badge = page.locator('#agent-chip');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText('Agent');
  await expect(page.locator('.status-chip')).toHaveText('Ready');   // still its own chip

  // The help is for a person's first use and this is not that, so the tooltip is the
  // whole of the explanation — and it has to be an explanation, not a label.
  const title = (await badge.getAttribute('title')) ?? '';
  expect(title).toMatch(/agent/i);
  expect(title.length).toBeGreaterThan(40);
});

test('the surface reports the app\u2019s own version', async ({ page }) => {
  await boot(page).gotoAgent();
  const version = await call<string>(page, 'version');
  const shown = (await page.locator('#ver').textContent()) ?? '';
  expect(shown).toBe(`v${version}`);
});

test('describe reports the clip, and a cut through the surface lands where a person sees it', async ({ page }) => {
  await reviewed(page);

  const before = await call<{ length: number; takes: unknown[]; cuts: unknown[] }>(page, 'describe');
  expect(before.length).toBeCloseTo(4);
  expect(before.takes).toHaveLength(1);
  expect(before.cuts).toHaveLength(0);

  // Half of the clip, through the surface's own operation.
  const cut = await call<{ ok: boolean; removed: number }>(page, 'edit.cut', 0.25, 0.5);
  expect(cut.ok).toBe(true);
  expect(cut.removed).toBeCloseTo(1);

  // What a person sees: the chip says what was cut, the undo is offered, and the
  // clip is shorter.
  await expect(page.locator('#t-cut')).toContainText('CUT');
  await expect(page.locator('#cut-undo')).toBeVisible();
  await expect(page.locator('#t-clip')).toHaveText('3.00s');
});

test('an annotation made through the surface is drawn on the picture and marked on the lane', async ({ page }) => {
  await reviewed(page);

  const made = await call<{ ok: boolean; id?: string }>(page, 'edit.annotate', 'arrow', {
    span: { s: 0.1, e: 0.9 },
    ...arrowPoints(0.2, 0.3, 0.7, 0.7),
  });
  expect(made.ok).toBe(true);

  await expect(page.locator('#tl-annots > *')).not.toHaveCount(0);

  const described = await call<{ annotations: Array<{ id: string; kind: string }> }>(page, 'describe');
  expect(described.annotations).toHaveLength(1);
  expect(described.annotations[0].kind).toBe('arrow');
});

test('a property change through the surface repaints, and one undo puts it back', async ({ page }) => {
  await reviewed(page);

  const made = await call<{ ok: boolean; id: string }>(page, 'edit.annotate', 'arrow', {
    span: { s: 0.1, e: 0.9 },
    ...arrowPoints(0.3, 0.5, 0.7, 0.5),
  });
  expect(made.ok).toBe(true);

  // Hold the frame the arrow is shown over, so the picture holds it. The seek draws
  // asynchronously, so each count waits for the paint rather than racing it.
  await call(page, 'view.seek', 1.5);
  await expectArrowPainted(page, 'red');

  const changed = await call<{ ok: boolean; value: string }>(page, 'edit.setProperty', made.id, 'colour', PALETTE_GREEN);
  expect(changed.ok).toBe(true);

  // The value is what the app holds...
  const described = await call<{ annotations: Array<{ properties: Array<{ id: string; value: string }> }> }>(page, 'describe');
  expect(described.annotations[0].properties[0]).toMatchObject({ id: 'colour', value: PALETTE_GREEN });

  // ...and the picture is painted differently: the arrow's red is gone and the green
  // is there instead. Counting a colour is a fact about what the layer painted.
  await call(page, 'view.seek', 1.5);
  await expectArrowPainted(page, 'green');

  // A colour the palette does not hold is refused, rather than silently becoming the
  // kind's default and reporting success.
  const refused = await call<{ ok: boolean; reason: string }>(page, 'edit.setProperty', made.id, 'colour', 'lime');
  expect(refused.ok).toBe(false);
  expect(refused.reason).toContain('lime');

  // The app's own undo takes the whole change back, in one action.
  const undone = await call<{ ok: boolean; change: string }>(page, 'edit.undo');
  expect(undone).toEqual({ ok: true, change: 'annotation-changed' });
  await call(page, 'view.seek', 1.5);
  await expectArrowPainted(page, 'red');
});

test('a refusal is a value, and leaves the clip alone', async ({ page }) => {
  await reviewed(page);

  const refused = await call<{ ok: boolean; reason: string }>(page, 'edit.cut', 0.5, 0.505);
  expect(refused.ok).toBe(false);
  expect(refused.reason).toBeTruthy();

  // Nothing happened: the clip is still its whole length and has no cuts.
  const described = await call<{ length: number; cuts: unknown[] }>(page, 'describe');
  expect(described.length).toBeCloseTo(4);
  expect(described.cuts).toHaveLength(0);

  // An operation the app does not have is refused too, with a reason.
  const unknown = await call<{ ok: boolean; reason: string }>(page, 'edit.annotate', 'hologram', { span: { s: 0.1, e: 0.5 } });
  expect(unknown.ok).toBe(false);
  expect(unknown.reason).toContain('hologram');
});

test('choosing what is shared is not the surface\u2019s to do', async ({ page }) => {
  await reviewed(page);

  const refused = await call<{ ok: boolean; reason: string }>(page, 'takes.turnSourceOn', 'screen');
  expect(refused.ok).toBe(false);
  expect(refused.reason).toContain('picker');
});

test('the press for the screen source asks for a share, and carries the activation the picker needs', async ({ page }) => {
  await installStandInShare(page);
  const app = boot(page);
  await app.gotoAgent();

  // The server delivers this one press as a real input event, because the browser
  // only opens the picker for a transient activation — which is what is asserted.
  await page.locator('#screen-btn').click();

  await expect.poll(async () => (await askedFor(page)) !== null).toBe(true);
  expect(await activationAtShare(page)).toBe(true);
});

test('a take started and stopped through the surface lands in the clip', async ({ page }) => {
  await installStandInShare(page);
  const app = boot(page);
  await app.gotoAgent();

  await page.locator('#screen-btn').click();
  await expect.poll(async () => (await askedFor(page)) !== null).toBe(true);

  const started = await call<{ ok: boolean }>(page, 'takes.start');
  expect(started.ok).toBe(true);
  await expect(page.locator('#rec-lbl')).toHaveText('Stop');

  // A moment of real recording, so the take has a length.
  await page.waitForTimeout(600);
  const stopped = await call<{ ok: boolean; take?: { index: number; seconds: number } }>(page, 'takes.stop');
  expect(stopped.ok).toBe(true);
  expect(stopped.take?.index).toBe(0);
  expect(stopped.take?.seconds ?? 0).toBeGreaterThan(0);

  const described = await call<{ takes: unknown[] }>(page, 'describe');
  expect(described.takes).toHaveLength(1);
});

test('a take with no picture is refused, with the reason a person would be told', async ({ page }) => {
  await boot(page).gotoAgent();

  const refused = await call<{ ok: boolean; reason: string }>(page, 'takes.start');
  expect(refused.ok).toBe(false);
  expect(refused.reason).toContain('picture');
});

test('a change the agent made is taken back by the app\u2019s own undo, in one action', async ({ page }) => {
  await reviewed(page);

  await call(page, 'edit.cut', 0.25, 0.5);
  await expect(page.locator('#t-clip')).toHaveText('3.00s');

  // The person presses the app's own undo — not the surface's — and the change goes
  // back in one action, whoever made it.
  await page.locator('#cut-undo').click();
  await expect(page.locator('#t-clip')).toHaveText('4.00s');
});

test('a page that did not ask carries no surface at all, before or after it is used', async ({ page }) => {
  const app = boot(page);
  await app.goto();

  // Not merely absent: nothing was published to be found, and the app carries on
  // being the app.
  expect(await page.evaluate(() => Object.keys(globalThis).filter(k => k === 'democlip'))).toEqual([]);
  await page.locator('#screen-btn').click();
  expect(await published(page)).toBe('undefined');
});

test('an export through the surface writes the file a person would get, holding the edit', async ({ page }) => {
  await reviewed(page);

  // An edit the file must carry: a second of the four gone, and an arrow over it.
  await call(page, 'edit.cut', 0.25, 0.5);
  await call(page, 'edit.annotate', 'arrow', {
    span: { s: 0.1, e: 0.9 },
    ...arrowPoints(0.3, 0.4, 0.7, 0.6),
  });

  const download = page.waitForEvent('download');
  const exported = await call<{ ok: boolean; filename: string }>(page, 'out.export', 'webm');
  expect(exported.ok).toBe(true);

  const file = await download;
  const path = await file.path();
  if (!path) throw new Error('the export wrote no file');
  const bytes = await readFile(path);
  expect(bytes.byteLength).toBeGreaterThan(1000);

  // The file is the clip the person watched: the cut is in it, so it is shorter.
  const duration = await durationOf(page, bytes, 'video/webm');
  expect(duration).toBeGreaterThan(2);
  expect(duration).toBeLessThan(4);
});

test('a publish with nobody signed in is refused, and nothing leaves the machine', async ({ page }) => {
  // The publishing service is out of reach, so a post that was attempted would fail
  // loudly rather than quietly succeed. The app's own font stylesheet is not the
  // service, so only what would reach Bluesky is counted.
  const toTheService: string[] = [];
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) return route.continue();
    if (/bluesky|bsky|atproto/i.test(url)) toTheService.push(url);
    return route.abort();
  });

  await reviewed(page);

  const refused = await call<{ ok: boolean; reason: string }>(page, 'out.publish', { text: 'hello' });
  expect(refused.ok).toBe(false);
  expect(refused.reason).toContain('signed in');
  // Nothing was sent to the service: no post was attempted at all.
  expect(toTheService).toEqual([]);
});

test('an export target the app does not write is refused', async ({ page }) => {
  await reviewed(page);

  const refused = await call<{ ok: boolean; reason: string }>(page, 'out.export', 'gif');
  expect(refused.ok).toBe(false);
  expect(refused.reason).toContain('gif');
});

/** Decode a downloaded file's metadata in the page and read its duration. */
async function durationOf(page: Page, bytes: Buffer, mime: string): Promise<number> {
  return page.evaluate(async ({ base64, type }) => {
    const binary = atob(base64);
    const data = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
    const blob = new Blob([data], { type });
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(blob);
    video.src = url;
    await new Promise<void>(resolve => {
      video.addEventListener('loadedmetadata', () => resolve(), { once: true });
      setTimeout(resolve, 3000);
    });
    const seconds = video.duration;
    URL.revokeObjectURL(url);
    return seconds;
  }, { base64: bytes.toString('base64'), type: mime });
}

/** The arrow's own shape: a tail and a head, as fractions of the picture. */
function arrowPoints(x0: number, y0: number, x1: number, y1: number): Record<string, unknown> {
  return { from: { x: x0, y: y0 }, to: { x: x1, y: y1 } };
}

/**
 * The most saturated pixel in a small window around a point of the picture, as
 * `r,g,b`. The window is what makes it find a thin mark — the arrow's shaft is a few
 * pixels wide — rather than whatever happens to be at the exact spot.
 */
const ARROW_RED = '#e53e3e';      // the arrow's own colour
const PALETTE_GREEN = '#38a169';  // another colour the palette holds

/** How much of each colour the preview holds right now, counted in one read. */
async function arrowColours(page: Page): Promise<{ red: number; green: number }> {
  return page.evaluate(([redCss, greenCss]) => {
    const canvas = document.querySelector<HTMLCanvasElement>('#preview');
    if (!canvas) return { red: -1, green: -1 };
    const context = canvas.getContext('2d');
    if (!context) return { red: -1, green: -1 };
    const want = (css: string): number[] => [1, 3, 5].map(at => parseInt(css.slice(at, at + 2), 16));
    const near = (a: number, b: number): boolean => Math.abs(a - b) <= 8;
    const red = want(redCss);
    const green = want(greenCss);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let reds = 0;
    let greens = 0;
    for (let at = 0; at < data.length; at += 4) {
      if (near(data[at], red[0]) && near(data[at + 1], red[1]) && near(data[at + 2], red[2])) reds++;
      else if (near(data[at], green[0]) && near(data[at + 1], green[1]) && near(data[at + 2], green[2])) greens++;
    }
    return { red: reds, green: greens };
  }, [ARROW_RED, PALETTE_GREEN]);
}

/**
 * Wait until the arrow is painted in one colour and not the other.
 *
 * A *state*, not a single read: the seek draws asynchronously, so one read can catch a
 * frame that is half painted — or blank, which would make "the red is gone" pass for
 * the wrong reason. Counting the colour is a fact about what the layer painted; the
 * fixture underneath is itself saturated, so sampling one pixel is a coin toss.
 */
async function expectArrowPainted(page: Page, colour: 'red' | 'green'): Promise<void> {
  await expect.poll(async () => {
    const counts = await arrowColours(page);
    return colour === 'red'
      ? counts.red > 10 && counts.green === 0
      : counts.green > 10 && counts.red === 0;
  }).toBe(true);
}
