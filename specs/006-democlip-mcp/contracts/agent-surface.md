# Contract — the agent surface

What the app offers to be driven, and what it promises. Everything here is what the
server is written against; the rules behind it are in `data-model.md`.

## 1. The gate

The surface is published on the page **only when the page asked for it**:

```ts
// src/main.ts
if (askedForAgent()) window.democlip = surface;   // the page was opened with ?agent=1
```

**Guarantees**

- a page without the flag publishes nothing: no global, no listener, no work (spec D1);
- the gate is the whole of the condition — there is no second way in;
- a check asserts both states, so the gate cannot rot into "always on".

## 2. The object

`src/ui/agent/surface.ts` — the app's own operations, and nothing else.

```ts
interface AgentSurface {
  readonly version: string;
  describe(): ClipDescription;
  sources(): { screen: boolean; webcam: boolean; microphone: boolean };
  readonly takes: { start(): Result; stop(): Promise<Result<{ take: TakeSummary }>> };
  readonly edit: {
    cut(from: number, to: number): Result;
    annotate(kind: string, params: AnnotationParams): Result<{ id: string }>;
    setProperty(id: string, property: string, value: string): Result;
    remove(id: string): Result;
    undo(): Result<{ change: string }>;
  };
  readonly view: { seek(seconds: number): Result; play(): Result; pause(): Result };
  readonly out: {
    export(target: 'webm' | 'mp4'): Promise<Result<{ filename: string }>>;
    publish(options: { text?: string; alt?: string }): Promise<Result<{ url: string }>>;
  };
}

type Result<T = Record<string, never>> = ({ ok: true } & T) | { ok: false; reason: string };
```

**Guarantees**

- **every operation is the app's own.** `cut` calls what the scissors calls, `annotate`
  what the section's action calls, `setProperty` goes through `changeAnnotation`, `undo`
  is the clip's one undo, `export` is the export flow, `publish` is the publishing flow.
  There is no second implementation of any rule (spec FR-007);
- **a refusal is a value**: `{ ok: false, reason }`, with the clip unchanged and nothing
  announced (FR-008). A tool call never fails the transport for an app-level no;
- **a change is an ordinary change**: announced to the app's views, taken back by the one
  undo, kept with the clip, and never a re-encode (FR-007, FR-009);
- **`describe()` is read-only** and says everything needed to decide what to do next
  (FR-010): the length, the takes, the cuts, the annotations, and each annotation's
  properties with the value it holds — the same list the inspector renders;
- **`sources()` is read-only.** Turning a source **on** is deliberately not here: it opens
  the browser's picker, which needs the person's activation, so the server delivers that
  one press as a real input event (D2). Turning one off is the app's own toggle and may be
  called here;
- **nothing reaches outside the clip**: no code evaluation, no page scripting, no file
  system, no network. The surface's methods are the whole of it (FR-015);
- **the version is the app's**, read from the build, so the server can refuse a page it
  does not match (FR-018).

## 3. The clip as data

```ts
interface ClipDescription {
  readonly length: number;
  readonly keptLength: number;
  readonly takes: readonly { index: number; seconds: number }[];
  readonly cuts: readonly { s: number; e: number }[];
  readonly annotations: readonly {
    id: string;
    kind: string;
    span: { s: number; e: number };
    properties: readonly { id: string; label: string; control: string; value: string }[];
  }[];
}
```

**Guarantees**

- spans and cuts are **fractions of the clip**, as everywhere else, so a tool call and a
  person's edit mean the same moment;
- a take is its index and its length; the bytes are the app's and are never handed out;
- it is a snapshot taken when asked — the app pushes nothing to the agent.

## 4. What the surface is not

- **not a sandbox.** The page and the server are one process apart in trust: the server is
  the person's own program, and it can reach the page. What is bounded is what the server
  *offers* — the tool list in `mcp-tools.md` — not what the page can be made to do. This is
  said here because the spec's FR-015 is a promise about the surface and the tools, and it
  should not be read as a security boundary it is not.
- **not a recorder.** It cannot choose what is shared, and it cannot make a capture happen
  without the browser's picker (FR-004).
- **not a second editor.** Every rule it touches already lives in a flow or in the domain.

## 5. The dependency rule

- `src/ui/agent/` imports the app's flows and the domain; it adds no rule of its own;
- `src/domain/` is untouched by this feature;
- the surface is published by `main.ts` and by nothing else;
- the server reaches the app **only** through the page, and knows nothing of `src/`.