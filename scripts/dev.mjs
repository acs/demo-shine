#!/usr/bin/env node
// Zero-dependency static server.
//
// Modes:
//   npm run dev        live reload + TypeScript watch (service worker disabled)
//   npm run preview    serve the built app as-is, so the PWA/service worker is active
//   --https            serve over TLS (adds dev:https / preview:https scripts)
//
// Certificates: pass --cert <pem> --key <pem>, or let it generate a self-signed
// pair into .certs/ on first use (needs the `openssl` CLI once). A self-signed
// cert is not trusted by browsers, so the service worker will not register until
// you trust it — for a locally-trusted cert use `mkcert localhost 127.0.0.1` and
// pass its files with --cert/--key.
import { spawn, execFileSync } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { existsSync, createReadStream, mkdirSync, readFileSync, statSync, watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT) || 5173;

const args = process.argv.slice(2);
const flag = name => args.includes(name) || process.env[name.replace(/^--/, 'ORBIT_').toUpperCase()] === '1';
const option = name => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : process.env[name.replace(/^--/, 'ORBIT_').toUpperCase()];
};

const PREVIEW = flag('--no-reload');
const HTTPS = flag('--https');
const CERT_ARG = option('--cert');
const KEY_ARG = option('--key');

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

// Injected into every HTML response in dev; flags the page so the app skips its
// service worker, and reloads when the server signals.
const RELOAD_SNIPPET = `
<script>
  // injected by scripts/dev.mjs — live reload
  window.__ORBIT_LIVE_RELOAD__ = true;
  (() => {
    const es = new EventSource('/__dev_reload');
    es.onmessage = () => location.reload();
  })();
</script>`;

/** @type {Set<import('node:http').ServerResponse>} */
const clients = new Set();

function injectReload(html) {
  return html.includes('</body>')
    ? html.replace('</body>', `${RELOAD_SNIPPET}\n</body>`)
    : html + RELOAD_SNIPPET;
}

async function handleRequest(req, res) {
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
    const body = PREVIEW ? html : injectReload(html);
    res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-cache' });
    res.end(body);
    return;
  }

  res.writeHead(200, {
    'Content-Type': TYPES[ext] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  createReadStream(target).pipe(res);
}

function tlsCredentials() {
  if (CERT_ARG && KEY_ARG) {
    return { key: readFileSync(KEY_ARG), cert: readFileSync(CERT_ARG), selfSigned: false };
  }
  const dir = join(ROOT, '.certs');
  const keyPath = join(dir, 'key.pem');
  const certPath = join(dir, 'cert.pem');
  if (!existsSync(certPath) || !existsSync(keyPath)) {
    mkdirSync(dir, { recursive: true });
    console.log('  generating a self-signed certificate in .certs/ …');
    try {
      execFileSync('openssl', [
        'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
        '-keyout', keyPath, '-out', certPath, '-days', '365',
        '-subj', '/CN=localhost',
        '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
      ], { stdio: ['ignore', 'ignore', 'inherit'] });
    } catch {
      throw new Error('could not run openssl — install it, or pass --cert <pem> --key <pem>');
    }
  }
  return { key: readFileSync(keyPath), cert: readFileSync(certPath), selfSigned: true };
}

const server = HTTPS
  ? createHttpsServer(tlsCredentials(), handleRequest)
  : createHttpServer(handleRequest);

function broadcast() {
  for (const client of clients) client.write('data: reload\n\n');
}

let debounce = null;
watch(ROOT, { recursive: true }, (_event, filename) => {
  if (!filename) return;
  const f = String(filename);
  // Ignore VCS internals, dependencies and the TS sources themselves — a .ts
  // edit reloads once its compiled .js lands.
  if (f.startsWith('.git/') || f.includes('node_modules') || f.startsWith('.certs/')) return;
  if (f.endsWith('.ts') || f.endsWith('.tsbuildinfo')) return;
  clearTimeout(debounce);
  debounce = setTimeout(broadcast, 80); // collapse bursts of events
});

// In dev, compile the TypeScript sources in watch mode if TypeScript is present.
let tsc = null;
if (!PREVIEW) {
  const tscBin = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
  if (existsSync(tscBin)) {
    tsc = spawn(process.execPath, [tscBin, '--watch', '--preserveWatchOutput'], { cwd: ROOT, stdio: 'inherit' });
  } else {
    console.warn('  (typescript not installed — run `npm install` to compile the .ts sources)');
  }
}

server.listen(PORT, () => {
  const scheme = HTTPS ? 'https' : 'http';
  console.log(`\n  Orbit Capture ${PREVIEW ? 'preview server (PWA active)' : 'dev server'}`);
  console.log(`  →  ${scheme}://localhost:${PORT}`);
  if (HTTPS) {
    console.log('  TLS: self-signed unless --cert/--key were given — browsers will warn,');
    console.log('       and the service worker needs a trusted cert (see `mkcert`)');
  }
  console.log(PREVIEW
    ? '  serving the built app — the service worker is enabled\n'
    : '  live reload on file change — Ctrl+C to stop\n');
});

function shutdown() {
  if (tsc) tsc.kill();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
