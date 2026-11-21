// Put the app's build inside the server's package.
//
// The server serves the app's own build, and shipping that build *inside* the package
// is what makes "the two agree on how a clip is written down" true by construction:
// the server can only ever drive the app it was released with. Run after
// `npm run build` at the repository root, and before `npm pack` / `npm publish`.

import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const built = fileURLToPath(new URL('../../dist', import.meta.url));
const into = fileURLToPath(new URL('../app', import.meta.url));

if (!existsSync(built)) {
  console.error('No app build at dist/ — run `npm run build` at the repository root first.');
  process.exit(1);
}

rmSync(into, { recursive: true, force: true });
cpSync(built, into, { recursive: true });
console.log(`Copied the app's build into ${into}`);
