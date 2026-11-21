// Keep the server's version equal to the app's.
//
// A clip's written shape is a contract between the server and the app, so the two are
// one release and carry one version. CI owns that number: it bumps the app's
// `package.json` on every merge to main, and this stamps the server's with the same
// value in the same run — so the two cannot drift, and the version check is a belt
// rather than the only thing holding them together.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const appPackage = fileURLToPath(new URL('../../package.json', import.meta.url));
const serverPackage = fileURLToPath(new URL('../package.json', import.meta.url));

const { version } = JSON.parse(readFileSync(appPackage, 'utf8'));
const pkg = JSON.parse(readFileSync(serverPackage, 'utf8'));

if (pkg.version === version) {
  console.log(`democlip-mcp is already at v${version}`);
} else {
  pkg.version = version;
  writeFileSync(serverPackage, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`democlip-mcp stamped v${version}`);
}
