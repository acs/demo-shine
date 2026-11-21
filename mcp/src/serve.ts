// Serving the app's own build, on loopback.
//
// The server ships the build it was released with and serves it from its own
// package, which is what makes "the server and the app agree on how a clip is
// written down" true by construction rather than a promise. Loopback is a **secure
// context**, so screen capture works with no certificate and no deployment — and
// nothing is hosted and no network is needed to record, edit or export.
//
// It is a static file server and nothing more: the build's own files, by path,
// with the MIME types a browser needs. No directory listing, no traversal.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

export interface AppServer {
  /** The loopback origin the app is served from. */
  readonly origin: string;
  /** The directory being served. */
  readonly root: string;
  close(): Promise<void>;
}

/** Serve a directory of the app's build on loopback, at a free port. */
export async function serveApp(root: string): Promise<AppServer> {
  const base = resolve(root);
  const server = createServer((req, res) => {
    void respond(base, req, res);
  });

  await new Promise<void>((done, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => done());
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    origin: `http://127.0.0.1:${port}`,
    root: base,
    close: () => new Promise<void>(done => server.close(() => done())),
  };
}

async function respond(base: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const path = pathFor(base, req.url ?? '/');
    if (!path) return send(res, 404, 'Not found');
    const info = await stat(path);
    if (!info.isFile()) return send(res, 404, 'Not found');
    const body = await readFile(path);
    res.writeHead(200, {
      'content-type': TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
      'content-length': body.byteLength,
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    send(res, 404, 'Not found');
  }
}

/** The file a request names, kept inside `base`; null when it escapes or is empty. */
function pathFor(base: string, url: string): string | null {
  const withoutQuery = url.split('?')[0].split('#')[0];
  const decoded = decodeURIComponent(withoutQuery);
  const relative = decoded === '/' || decoded === '' ? 'index.html' : decoded.replace(/^\/+/, '');
  const path = resolve(join(base, relative));
  if (path !== base && !path.startsWith(base + sep)) return null;
  return path;
}

function send(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(body);
}
