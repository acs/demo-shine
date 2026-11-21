// The tools the harness sees.
//
// One tool per operation the app has, named in the app's own vocabulary, so a person
// reading a chat recognises what was done. There is no tool that evaluates code,
// scripts the page, reads or writes a file, or reaches the network except through
// `publish_clip` — what the server offers is exactly what the surface publishes, and
// the two lists cannot drift apart.
//
// An app-level refusal is a **result**, not a transport error: the surface answers
// `{ ok: false, reason }` and the tool hands that back, so the agent can read it and
// try something else.

import type { Session } from './session.js';

export type Args = Readonly<Record<string, unknown>>;

export interface JsonSchema {
  readonly type: 'object';
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
}

export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
  run(session: Session, args: Args): Promise<unknown>;
}

/** A property of the clip, named in the app's words. */
const clipArgs: JsonSchema = { type: 'object', properties: {}, additionalProperties: false };

/**
 * Reach the app's automation surface in the page and call one of its operations.
 * The path is dotted for a group: `edit.cut`, `out.export`.
 */
export async function callSurface<T>(session: Session, path: string, ...args: unknown[]): Promise<T> {
  return session.page.evaluate(
    ({ path, args }) => {
      const surface = (globalThis as { democlip?: Record<string, unknown> }).democlip;
      if (!surface) throw new Error('the page has no automation surface');
      const parts = path.split('.');
      let owner: unknown = surface;
      for (const part of parts.slice(0, -1)) {
        owner = (owner as Record<string, unknown> | undefined)?.[part];
      }
      const fn = (owner as Record<string, unknown> | undefined)?.[parts[parts.length - 1]];
      if (typeof fn !== 'function') throw new Error(`the app offers no ${path}`);
      return (fn as (...a: unknown[]) => unknown).apply(owner, args);
    },
    { path, args },
  ) as Promise<T>;
}

/** What the clip is: the length, the takes, the cuts, the annotations and their properties. */
const describeClip: Tool = {
  name: 'describe_clip',
  description:
    'Read the clip: its length in seconds, how much is left after the cuts, the takes, the cuts as fractions of the clip, and every annotation with its kind, its stretch and the properties it holds. Read-only; call it before deciding what to change.',
  inputSchema: clipArgs,
  run: session => callSurface(session, 'describe'),
};

/** Every tool the server offers, in the order a reader should meet them. */
export function toolList(): readonly Tool[] {
  return [describeClip];
}

export function findTool(name: string): Tool | null {
  return toolList().find(tool => tool.name === name) ?? null;
}

/** The tools as the protocol describes them, without their implementations. */
export function toolDefinitions(): ReadonlyArray<Pick<Tool, 'name' | 'description' | 'inputSchema'>> {
  return toolList().map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}
