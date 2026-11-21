// How the page reaches a module at the repository root.
//
// The Vite root is `web/`, so a page cannot name a file at the repository root by its
// path: the dev server answers with the page itself. A file outside the root is served
// at `/@fs/<absolute path>`, which is what a check imports in page context. The
// absolute path is computed here, from this file's own location, so nothing in the
// source is machine-specific.

import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** A page-side module at the repository root, as the dev server serves it. */
export function pageModule(path: string): string {
  return `/@fs${ROOT}/${path}`;
}
