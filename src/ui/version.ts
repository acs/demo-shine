// The build's version, shown beside the logo.
//
// A PWA can go on serving an older shell for a while — that is what the service
// worker is for — so the number on screen is how you tell which build a window
// is actually running, and whether a reload really did pick up a new deploy.
//
// It is set from `package.json` at build time (see vite.config.ts) and bumped by
// the deploy workflow on every merge to main, so the tag, the deployed build and
// the number in the corner all agree.

import { el } from './dom.js';

// `typeof` is safe when the build never substituted it — a bare test run, say.
const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

export function showVersion(): void {
  el.ver.textContent = 'v' + VERSION;
  el.ver.title = 'DemoShine v' + VERSION;
}
