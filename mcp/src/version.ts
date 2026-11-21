// The version this server was built with.
//
// It is the server's own package version, which the release stamps to the app's, so
// the two agree by construction. The app's automation surface reports *its* version,
// and the session refuses to drive a page that does not match: a clip's written
// shape is a contract between the two, and a half-read clip is a bug hunt, so a
// mismatch is refused with a sentence instead.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function serverVersion(): string {
  try {
    const path = fileURLToPath(new URL('../package.json', import.meta.url));
    const pkg = JSON.parse(readFileSync(path, 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * The reason a page cannot be driven, or null when it can.
 *
 * A page that reports no version at all was opened without the surface; a page whose
 * version differs from ours is a different release, and a clip's written shape is a
 * contract between the two — so it is refused rather than half-read.
 */
export function versionMismatchReason(appVersion: string, server: string): string | null {
  if (!appVersion) return 'the page was opened without the automation surface';
  if (appVersion !== server) {
    return `the app is v${appVersion} and this server is v${server} — they are not the same release, so nothing was driven`;
  }
  return null;
}
