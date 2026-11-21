import { createServer, type Server } from 'node:http';
import { afterAll, describe, expect, it } from 'vitest';

import { freePort, waitForEndpoint } from './browser.js';

// The two pieces of the macOS launch that can be proved without a browser: finding a
// port nothing is on, and waiting for the browser to answer on it. The rest of that
// path is a real Chrome, which only a session on a Mac can show.

describe('finding a port for the browser to listen on', () => {
  it('hands back a port that is free, and lets go of it', async () => {
    const port = await freePort();
    expect(port).toBeGreaterThan(1023);

    // Free means free: we can take it ourselves.
    const taken = createServer();
    await new Promise<void>((done, fail) => {
      taken.once('error', fail);
      taken.listen(port, '127.0.0.1', () => done());
    });
    await new Promise<void>(done => taken.close(() => done()));
  });
});

describe('waiting for the browser to answer', () => {
  let server: Server | null = null;

  afterAll(async () => {
    if (server) await new Promise<void>(done => server!.close(() => done()));
  });

  it('returns as soon as it answers', async () => {
    server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ Browser: 'Chrome' }));
    });
    await new Promise<void>(done => server!.listen(0, '127.0.0.1', () => done()));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    await expect(waitForEndpoint(`http://127.0.0.1:${port}`, 5_000)).resolves.toBeUndefined();
  });

  it('gives up with a reason rather than hanging, when nothing ever answers', async () => {
    const port = await freePort();
    await expect(waitForEndpoint(`http://127.0.0.1:${port}`, 700)).rejects.toThrow(/did not open a debugging port/);
  });
});
