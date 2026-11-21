// The MCP server: the tools, over stdio.
//
// It holds one session, opened on the first tool call rather than at startup, so
// having the server configured does not open a browser window until the person asks
// for something. A session that fails to open — no browser, no display, a version
// that does not match — is reported plainly and nothing half-starts.
//
// Nothing is written to stdout but the protocol: a stray log line would be read as a
// message. Anything a person should see goes to stderr.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Session } from './session.js';
import { serverVersion } from './version.js';
import { findTool, toolDefinitions, type Args } from './tools.js';

export interface BuildOptions {
  /** How a session is opened, on demand. */
  readonly openSession: () => Promise<Session>;
}

export type ToolCallResult = {
  readonly content: Array<{ readonly type: 'text'; readonly text: string }>;
  readonly isError: boolean;
};

export function buildServer(options: BuildOptions): Server {
  const server = new Server(
    { name: 'democlip', version: serverVersion() },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolDefinitions() }));

  server.setRequestHandler(CallToolRequestSchema, async request =>
    handleToolCall(options, request.params.name, (request.params.arguments ?? {}) as Args));

  return server;
}

/**
 * One tool call: open the session if it is not open, hand the call to the operation
 * behind the tool, and answer. An app-level refusal comes back as the operation's
 * own `{ ok: false, reason }` — a result, not an error. A failure to *have* a session
 * is an error, said plainly.
 */
export async function handleToolCall(
  options: BuildOptions,
  name: string,
  args: Args,
): Promise<ToolCallResult> {
  const tool = findTool(name);
  if (!tool) return failure(`no tool named ${name}`);
  try {
    const session = await options.openSession();
    const result = await tool.run(session, args);
    return { content: [{ type: 'text', text: JSON.stringify(result) }], isError: false };
  } catch (error) {
    return failure(messageOf(error));
  }
}

function failure(reason: string): ToolCallResult {
  return { content: [{ type: 'text', text: JSON.stringify({ ok: false, reason }) }], isError: true };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'the call failed';
}
