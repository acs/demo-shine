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
import { pressScreenButton, screenCaptureBlocked } from './press.js';
import { watchDownload } from './downloads.js';

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

const SOURCES = ['screen', 'webcam', 'microphone'] as const;

function objectSchema(properties: Readonly<Record<string, unknown>> = {}, required: readonly string[] = []): JsonSchema {
  return { type: 'object', properties, required, additionalProperties: false };
}

const fraction = (description: string): unknown => ({
  type: 'number',
  minimum: 0,
  maximum: 1,
  description,
});

/**
 * Reach the app's automation surface in the page and call one of its operations.
 * The path is dotted for a group: `edit.cut`, `view.seek`.
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
  inputSchema: objectSchema(),
  run: session => callSurface(session, 'describe'),
};

/** Take a stretch out of the clip. */
const cut: Tool = {
  name: 'cut',
  description:
    'Cut a stretch out of the clip. `from` and `to` are fractions of the clip (0 to 1). The stretch leaves the timeline and what is left closes up; one undo puts it back.',
  inputSchema: objectSchema({ from: fraction('Where the cut starts'), to: fraction('Where it ends') }, ['from', 'to']),
  run: (session, args) => callSurface(session, 'edit.cut', args.from, args.to),
};

/** Draw an annotation over a stretch. */
const annotate: Tool = {
  name: 'annotate',
  description:
    'Add an annotation over a stretch of the clip. `kind` is "arrow" or "text", and `span` is { s, e } as fractions of the clip giving the stretch it is shown over. An arrow needs `from` and `to`, each { x, y } as fractions of the picture. A text needs `text`, and may take `x`, `y` and `height` (fractions) to place it. An "image" annotation cannot be made here: its picture is the person\u2019s to choose.',
  inputSchema: objectSchema({
    kind: { type: 'string', enum: ['arrow', 'text'], description: 'Which kind of annotation' },
    span: {
      type: 'object',
      properties: { s: fraction('Where the stretch starts'), e: fraction('Where it ends') },
      required: ['s', 'e'],
      description: 'The stretch of the clip the annotation is shown over',
    },
    from: { type: 'object', description: 'The arrow\u2019s tail, as { x, y } fractions of the picture' },
    to: { type: 'object', description: 'The arrow\u2019s head, as { x, y } fractions of the picture' },
    text: { type: 'string', description: 'The words, for a text' },
    x: { type: 'number', description: 'Where a text is placed, as a fraction of the width' },
    y: { type: 'number', description: 'Where a text is placed, as a fraction of the height' },
    height: { type: 'number', description: 'How tall a text is, as a fraction of the height' },
  }, ['kind', 'span']),
  run: (session, args) => callSurface(session, 'edit.annotate', String(args.kind ?? ''), args),
};

/** Change something about a placed annotation. */
const setProperty: Tool = {
  name: 'set_property',
  description:
    'Change one property of a placed annotation: `id` from describe_clip, the property ("colour", or "words" for a text), and the value. A colour is one of the app\u2019s palette names.',
  inputSchema: objectSchema({
    id: { type: 'string', description: 'The annotation\u2019s id, from describe_clip' },
    property: { type: 'string', description: 'Which property, such as "colour" or "words"' },
    value: { type: 'string', description: 'The new value' },
  }, ['id', 'property', 'value']),
  run: (session, args) => callSurface(session, 'edit.setProperty', args.id, args.property, args.value),
};

/** Take a placed annotation away. */
const removeAnnotation: Tool = {
  name: 'remove_annotation',
  description: 'Remove one annotation by its id. One undo puts it back.',
  inputSchema: objectSchema({ id: { type: 'string', description: 'The annotation\u2019s id' } }, ['id']),
  run: (session, args) => callSurface(session, 'edit.remove', args.id),
};

/** Take the last change back. */
const undo: Tool = {
  name: 'undo',
  description:
    'Take back the last change to the clip, whatever kind it was — a cut, an annotation, a property, whoever made it. One call is one change: an instruction that made a dozen cuts needs a dozen calls.',
  inputSchema: objectSchema(),
  run: session => callSurface(session, 'edit.undo'),
};

/** Move the playhead. */
const seek: Tool = {
  name: 'seek',
  description: 'Move the playhead to a moment, in seconds from the start of the clip, and hold the frame there.',
  inputSchema: objectSchema({ seconds: { type: 'number', minimum: 0, description: 'Seconds from the start' } }, ['seconds']),
  run: (session, args) => callSurface(session, 'view.seek', args.seconds),
};

/** Start a take. */
const startTake: Tool = {
  name: 'start_take',
  description:
    'Start recording a take. Needs a picture: turn the screen or the webcam on first. The take is appended to the end of the clip.',
  inputSchema: objectSchema(),
  run: session => callSurface(session, 'takes.start'),
};

/** Stop the take in flight. */
const stopTake: Tool = {
  name: 'stop_take',
  description: 'Stop the take in flight and answer with the take that arrived, and how long it is.',
  inputSchema: objectSchema(),
  run: session => callSurface(session, 'takes.stop'),
};

/** Turn a source on. */
const turnSourceOn: Tool = {
  name: 'turn_source_on',
  description:
    'Turn a source on: "screen", "webcam" or "microphone". For "screen" this is a real press on the app\u2019s own Screen button, so the browser opens its picker and the person chooses what to share — you cannot choose it, and you should say that the picker is waiting.',
  inputSchema: objectSchema({ source: { type: 'string', enum: [...SOURCES], description: 'Which source' } }, ['source']),
  async run(session, args) {
    const source = String(args.source ?? '');
    if (source === 'screen') {
      // macOS grants Screen Recording per application bundle, so a browser it does not
      // recognise cannot be granted it and the picker would never open. Say so, rather
      // than pressing a button that does nothing.
      const blocked = screenCaptureBlocked(session.browser, process.platform);
      if (blocked) return { ok: false, reason: blocked };
      const pressed = await pressScreenButton(session);
      if (!pressed.pressed) return { ok: false, reason: pressed.reason };
      return { ok: true, sources: await callSurface(session, 'sources'), note: 'the browser is asking the person what to share' };
    }
    return callSurface(session, 'takes.turnSourceOn', source);
  },
};

/** Turn a source off. */
const turnSourceOff: Tool = {
  name: 'turn_source_off',
  description: 'Turn a source off: "screen", "webcam" or "microphone".',
  inputSchema: objectSchema({ source: { type: 'string', enum: [...SOURCES], description: 'Which source' } }, ['source']),
  run: (session, args) => callSurface(session, 'takes.turnSourceOff', args.source),
};

/** Encode the clip and write it to a file. */
const exportClip: Tool = {
  name: 'export_clip',
  description:
    'Encode the clip offline and write it to a file, answering with the path it was written to and its size. `target` is "webm" or "mp4". The file holds exactly the cuts and annotations the person watched.',
  inputSchema: objectSchema({ target: { type: 'string', enum: ['webm', 'mp4'], description: 'Which container' } }, ['target']),
  async run(session, args) {
    const target = String(args.target ?? '');
    if (target !== 'webm' && target !== 'mp4') {
      return { ok: false, reason: `the app exports webm or mp4, not ${target}` };
    }
    // The browser hands the finished file back as a download, so the watcher goes up
    // before the export is asked for — a download already fired is one you cannot wait
    // for.
    const watcher = watchDownload(session.page, session.downloadsDir);
    const outcome = await callSurface<{ ok: boolean; filename?: string; reason?: string }>(
      session, 'out.export', target,
    );
    if (!outcome.ok) {
      watcher.stop();
      return outcome;
    }
    const saved = await watcher.saved;
    return { ok: true, path: saved.path, bytes: saved.bytes, filename: outcome.filename };
  },
};

/** Post the clip, from the person's own account. */
const publishClip: Tool = {
  name: 'publish_clip',
  description:
    'Post the clip to Bluesky, from the account the person signed in with in this window. Needs a sign-in: with nobody signed in it is refused with a reason and nothing leaves the machine. `text` is the post\u2019s words and `alt` describes the video.',
  inputSchema: objectSchema({
    text: { type: 'string', description: 'The post\u2019s words' },
    alt: { type: 'string', description: 'A description of the video, for readers who cannot see it' },
  }),
  run: (session, args) => callSurface(session, 'out.publish', { text: args.text, alt: args.alt }),
};

/** Every tool the server offers, in the order a reader should meet them. */
export function toolList(): readonly Tool[] {
  return [
    describeClip,
    cut,
    annotate,
    setProperty,
    removeAnnotation,
    undo,
    seek,
    startTake,
    stopTake,
    turnSourceOn,
    turnSourceOff,
    exportClip,
    publishClip,
  ];
}

export function findTool(name: string): Tool | null {
  return toolList().find(tool => tool.name === name) ?? null;
}

/** The tools as the protocol describes them, without their implementations. */
export function toolDefinitions(): ReadonlyArray<Pick<Tool, 'name' | 'description' | 'inputSchema'>> {
  return toolList().map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}
