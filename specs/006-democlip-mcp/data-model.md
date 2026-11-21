# Phase 1 — Data Model

The entities this feature adds, their shapes, the rules they enforce, and how they move.
Field names are the ones the code will use; the words are the ones `GLOSSARY.md` gains
first (step 1 of the plan).

## New entity — `AgentSession`, the sitting

The whole of one session: a browser the server opened, the app in it, and the person
watching. Held by the server, one at a time.

| Piece | Meaning |
|---|---|
| the browser | launched headful, on a profile of its own, kept for the session's life |
| the page | the app's own build, served by the server on loopback, opened with the flag that asks for the surface |
| the app's version | read from the surface at the start, and checked against the server's (D7) |
| the clip | the app's, in that page, exactly as a person's is |

**Rules**

- one session at a time in this version (D8);
- closing the window ends the session's browser, not the clip: the app keeps the clip as
  it always does, and a new session finds it where it left it;
- nothing about the app's promises changes because an agent is driving: nothing leaves
  the machine unless a person asked for an export or a post.

## New entity — `AgentSurface`, what the app offers

`src/ui/agent/surface.ts` — one object, published on the page only when the page asked
for it. It names the app's own operations and nothing else.

```ts
interface AgentSurface {
  /** The app's version, so the server can refuse a page it does not match. */
  readonly version: string;

  /** What the clip is, as data. Read-only. */
  describe(): ClipDescription;

  /** Which sources are on. Read-only — turning one on is the server's own press (D2). */
  sources(): { screen: boolean; webcam: boolean; microphone: boolean };

  readonly takes: {
    start(): Result;
    stop(): Promise<Result<{ take: TakeSummary }>>;
  };

  readonly edit: {
    cut(from: number, to: number): Result;
    annotate(kind: string, params: AnnotationParams): Result<{ id: string }>;
    setProperty(id: string, property: string, value: string): Result;
    remove(id: string): Result;
    undo(): Result<{ change: string }>;
  };

  readonly view: {
    seek(seconds: number): Result;
    play(): Result;
    pause(): Result;
  };

  readonly out: {
    export(target: 'webm' | 'mp4'): Promise<Result<{ filename: string }>>;
    publish(options: { text?: string; alt?: string }): Promise<Result<{ url: string }>>;
  };
}

type Result<T = Record<string, never>> = { ok: true } & T | { ok: false; reason: string };
```

**Rules**

- **it exists only when asked.** Without the flag the page publishes nothing, and a check
  asserts that (D1);
- **every operation calls the app's own flow.** Cutting calls what the scissors calls,
  annotating what the section's action calls, and a property change goes through
  `changeAnnotation` — so a change announces, is taken back by the one undo, and is kept
  with the clip, with no second path (spec FR-007);
- **a refusal is a value, not a throw.** An operation the app will not do — a stretch too
  short, an annotation kind it does not know, a property value it refuses, an export it
  cannot encode — returns `{ ok: false, reason }` and leaves the clip unchanged (FR-008);
- **nothing here re-encodes the recording** (FR-009): the operations are the app's, and
  the app's do not;
- **`describe()` is read-only**, and says everything the agent needs to decide what to do
  next (FR-010);
- **no operation reaches outside the clip**: no code evaluation, no page scripting, no
  file system (FR-015).

## New entity — `ClipDescription`, what the agent can see

The read side of the surface: the clip as plain data, so the agent can look before it
leaps.

```ts
interface ClipDescription {
  readonly length: number;                     // seconds, the whole clip
  readonly keptLength: number;                 // seconds, once the cuts are gone
  readonly takes: readonly TakeSummary[];      // { index, seconds }
  readonly cuts: readonly { s: number; e: number }[];          // fractions of the clip
  readonly annotations: readonly AnnotationSummary[];
}

interface AnnotationSummary {
  readonly id: string;
  readonly kind: string;                       // 'arrow' | 'image' | 'text'
  readonly span: { s: number; e: number };     // fractions of the clip
  readonly properties: readonly { id: string; label: string; control: string; value: string }[];
}
```

**Rules**

- the spans are fractions of the clip, as everywhere else in the app, so a tool call and a
  person's edit mean the same thing;
- the properties are the ones the kind declares (`propertiesOf`), with the value each
  holds — the same list the inspector renders, so the agent sees exactly what a person
  would be offered;
- it is a snapshot, taken when asked: nothing is pushed to the agent.

## New entity — `Operation`, one thing done

| Piece | Meaning |
|---|---|
| name | the app's word for it: `cut`, `annotate`, `setProperty`, `remove`, `undo`, `seek`, `take.start`, `export`, `publish` |
| inputs | the numbers and strings the app's own flow takes |
| result | `{ ok: true, … }`, or `{ ok: false, reason }` |
| the clip's change | whatever the flow announced — one change, undone on its own (spec Q2) |

**Rules**

- one call is one change to the clip, and one press of the person's undo — there is no
  group, and the app's undo is unchanged;
- a call that changes nothing (a refused one) announces nothing.

## New entity — `Tool`, what the harness sees

`mcp/src/tools.ts` — the list the server offers, one per operation, named in the app's
vocabulary (D4). Each carries a description a model can act on, an input schema, and what
it returns.

| Tool | Operation |
|---|---|
| `describe_clip` | `describe()` |
| `cut` | `edit.cut` |
| `annotate` | `edit.annotate` |
| `set_property` | `edit.setProperty` |
| `remove_annotation` | `edit.remove` |
| `undo` | `edit.undo` |
| `seek` | `view.seek` |
| `start_take`, `stop_take` | `takes.start`, `takes.stop` |
| `turn_source_on`, `turn_source_off` | the server's own trusted press (D2) |
| `export_clip` | `out.export`, then the download out to a path |
| `publish_clip` | `out.publish` |

**Rules**

- there is **no** tool that evaluates code or scripts the page (FR-015);
- a tool whose operation refused returns the reason as its result, not as a transport
  error, so the agent can read it and try something else (FR-008);
- a tool that needs a version that does not match is refused before it is called (D7).

## Changed entity — the app's entry

`src/main.ts` — one addition: when the page was opened asking for it, publish the surface.

**Rules**

- the flag is the whole of the gate: no flag, no surface, nothing published (D1);
- publishing the surface adds no listener, no timer and no work to a page that did not
  ask.

## State transitions

| From | Event | Effect |
|---|---|---|
| a page opened without the flag | — | no surface; the app is the app (spec FR-017) |
| a page opened with the flag | the surface is published | `window.democlip` is the operations |
| a session | the person picks what to share in the picker | a source is on; the clip can record |
| a source on | the agent asks for a take | the app's own recording starts; the take arrives as it always does |
| a clip | the agent cuts, annotates or sets a property | the flow announces; the person sees it; one undo takes it back |
| a clip | the agent asks for an export | the app encodes offline; the browser downloads the file; the server saves it and tells the person where |
| a signed-in page | the agent publishes | the app's flow posts; the person is told the post's address |
| a page not signed in | the agent publishes | `{ ok: false, reason }`; nothing leaves the machine |
| a session | the window is closed | the browser goes; the clip stays where the app keeps it |