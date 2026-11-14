#!/usr/bin/env node
// Assemble a deployable static build into dist/.
//
// `npm run build` already compiled src/**/*.js next to the sources (and that
// output is gitignored), so this copies the shell plus the compiled JavaScript
// into a single folder a static host can publish.
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = join(ROOT, 'dist');
const SHELL = ['index.html', 'styles.css', 'manifest.json', 'sw.js', 'icon.svg'];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const file of SHELL) await cp(join(ROOT, file), join(OUT, file));

async function copyJs(from, to) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const src = join(from, entry.name);
    const dst = join(to, entry.name);
    if (entry.isDirectory()) await copyJs(src, dst);
    else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) await cp(src, dst);
  }
}

await copyJs(join(ROOT, 'src'), join(OUT, 'src'));

console.log(`Built static site → ${OUT}`);
