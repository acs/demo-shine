#!/usr/bin/env node
// Zero-dependency dev server with live reload.
//
// Serves the repository root, compiles the TypeScript sources in watch mode,
// and reloads every connected browser as soon as a file changes. No bundler,
// no runtime dependencies — just Node's standard library.
// Usage: `npm run dev` (or `node scripts/dev.mjs`).
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, createReadStream, statSync, watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT) || 5173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.webm': 'video/webm',
  '.gif':  'image/gif',
  '.map':  'application/json; charset=utf-8',
};

// Injected into every HTML response; reloads the page when the server signals.
const RELOAD_SNIPPET = `
<script>
  // injected by scripts/dev.mjs — live reload
  (() => {
    const es = new EventSource('/__dev_reload');
    es.onmessage = () => location.reload();
  })();
</script>`;

/** @type {Set<import('node:http').ServerResponse>} */
const clients = new Set();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/__dev_reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';

  const filePath = resolve(join(ROOT, normalize(pathname)));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + '/')) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  let stat;
  try {
    stat = statSync(filePath);
  } catch {
    res.writeHead(404).end('Not found');
    return;
  }
  const target = stat.isDirectory() ? join(filePath, 'index.html') : filePath;
  const ext = extname(target).toLowerCase();

  if (ext === '.html') {
    const html = await readFile(target, 'utf8');
    const body = html.includes('</body>')
      ? html.replace('</body>', `${RELOAD_SNIPPET}\n</body>`)
      : html + RELOAD_SNIPPET;
    res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-cache' });
    res.end(body);
    return;
  }

  res.writeHead(200, {
    'Content-Type': TYPES[ext] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  createReadStream(target).pipe(res);
});

function broadcast() {
  for (const client of clients) client.write('data: reload\n\n');
}

let debounce = null;
watch(ROOT, { recursive: true }, (_event, filename) => {
  if (!filename) return;
  const f = String(filename);
  // Ignore VCS internals, dependencies and the TS sources themselves — a .ts
  // edit reloads once its compiled .js lands.
  if (f.startsWith('.git/') || f.includes('node_modules')) return;
  if (f.endsWith('.ts') || f.endsWith('.tsbuildinfo')) return;
  clearTimeout(debounce);
  debounce = setTimeout(broadcast, 80); // collapse bursts of events
});

// Compile the TypeScript sources in watch mode, if TypeScript is installed.
const tscBin = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
let tsc = null;
if (existsSync(tscBin)) {
  tsc = spawn(process.execPath, [tscBin, '--watch', '--preserveWatchOutput'], { cwd: ROOT, stdio: 'inherit' });
} else {
  console.warn('  (typescript not installed — run `npm install` to compile the .ts sources)');
}

server.listen(PORT, () => {
  console.log(`\n  Orbit Capture dev server`);
  console.log(`  →  http://localhost:${PORT}`);
  console.log(`  live reload on file change — Ctrl+C to stop\n`);
});

function shutdown() {
  if (tsc) tsc.kill();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
