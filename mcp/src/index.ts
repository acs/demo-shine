#!/usr/bin/env node
// The entry point: the server on stdio, for a harness to start.
//
// The session opens on the first tool call, so configuring the server does not open
// a browser on its own. `DEMOCLIP_HEADLESS=1` runs the browser without a window,
// which the server's own checks use; a session for a person is headful.

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer } from './server.js';
import { openSession, type Session } from './session.js';

let pending: Promise<Session> | null = null;

function session(): Promise<Session> {
  if (!pending) {
    pending = openSession({ headless: process.env.DEMOCLIP_HEADLESS === '1' }).catch(error => {
      pending = null;                  // a failed open must not poison the next call
      throw error;
    });
  }
  return pending;
}

const server = buildServer({ openSession: session });

const transport = new StdioServerTransport();
await server.connect(transport);

// The browser goes when the harness does, so a session never leaves a window behind.
const close = async (): Promise<void> => {
  if (pending) await pending.then(open => open.close()).catch(() => {});
  process.exit(0);
};
process.on('SIGINT', () => void close());
process.on('SIGTERM', () => void close());
