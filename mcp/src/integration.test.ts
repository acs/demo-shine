import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openSession, type Session } from './session.js';
import { handleToolCall, type BuildOptions } from './server.js';
import { serverVersion } from './version.js';

// The server, end to end: the app's own build served on loopback, a real browser on
// it, and a tool call answered by the app. This is the one check that proves the two
// halves meet — the surface in the page and the server beside it — and it is the
// slowest, because it opens a browser.
//
// The browser is headless here, which is a property of the *check*, not of a session:
// a session for a person is headful, because watching the edits land is the feature.

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const builtApp = fileURLToPath(new URL('../../dist/index.html', import.meta.url));
const builtVersion = fileURLToPath(new URL('../../dist/version.json', import.meta.url));

/**
 * Build the app unless the build on disk is already this release's.
 *
 * The check drives the app *this checkout* built, and the session refuses a page whose
 * version is not its own — which is correct, and which turns a stale build into a
 * puzzling failure after a branch switch. So the build is made current instead.
 */
function ensureBuiltApp(): void {
  if (existsSync(builtApp) && builtVersionOnDisk() === serverVersion()) return;
  execSync('npm run build', { cwd: repoRoot, stdio: 'inherit' });
}

function builtVersionOnDisk(): string {
  try {
    const build = JSON.parse(readFileSync(builtVersion, 'utf8')) as { version?: string };
    return build.version ?? '';
  } catch {
    return '';
  }
}

describe('the server, end to end', () => {
  let session: Session;

  beforeAll(async () => {
    ensureBuiltApp();
    // The build from *this checkout*, explicitly: the released server prefers the
    // build packaged inside it, which is right for a release and wrong for a check —
    // a stale packaged copy must never be able to make this pass.
    session = await openSession({
      headless: true,
      appRoot: fileURLToPath(new URL('../../dist', import.meta.url)),
    });
  }, 300_000);

  afterAll(async () => {
    await session?.close();
  });

  it('opens the app it shipped, agrees on the version, and reads the clip', async () => {
    const options: BuildOptions = { openSession: async () => session };
    const result = await handleToolCall(options, 'describe_clip', {});
    expect(result.isError).toBe(false);

    const described = JSON.parse(result.content[0].text) as Record<string, unknown>;
    expect(described).toMatchObject({ length: 0, keptLength: 0, takes: [], cuts: [], annotations: [] });
  });

  it('serves the app on loopback and reports the version the two agree on', async () => {
    expect(session.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(session.version).toBe(serverVersion());
  });
});
