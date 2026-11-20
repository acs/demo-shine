# Phase 1 — Data Model

The entities the feature adds or changes, their fields, the rules they enforce, and
how they move. Field names are the ones the code will use; the words are the ones
`GLOSSARY.md` gains first (step 1 of the plan).

## Changed entity — `Annotation`, the base class

`src/domain/annotation/Annotation.ts`

| Member | Change |
|---|---|
| `withHandle(end, to)` | gains one optional argument: `withHandle(end: string, to: Point, options?: HandleOptions): Annotation \| null` |
| `handles()`, `movedBy`, `withSpan`, `duplicated`, `hitTest`, `stored()` | unchanged |

```ts
/** What a resize may be told beyond where the handle went. */
export interface HandleOptions {
  /** The user is asking for a free resize — a modifier is held. */
  readonly free?: boolean;
}
```

**Rules**

- the argument is **optional**, so `Arrow.withHandle(end, to)` and every existing call
  compile and behave unchanged — this is why the `Arrow` tests pass unmodified
  (spec SC-003);
- a kind that ignores `options` — the arrow — is unaffected by it;
- `handles()` is still the whole of what a drag can take hold of, so the shared canvas
  draws a kind's grips and controls from it without knowing the kind (spec FR-001,
  FR-004).

## New entity — `ImageAnnotation`, the image kind

`src/domain/annotation/ImageAnnotation.ts` — `class ImageAnnotation extends Annotation`

```ts
export interface ImageGeometry {
  /** Which kept picture this is — resolved to bytes in `infra/`, never here. */
  readonly imageId: string;
  /** The rect, as fractions of the picture: top-left, width, height. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** The picture's own pixel width ÷ height — what a keep-proportions resize holds. */
  readonly imageAspect: number;
  /** The recorded picture's pixel width ÷ height when it was made — the other half. */
  readonly pictureAspect: number;
}
```

| Member | Meaning |
|---|---|
| `ImageAnnotation.id` | `'image'` — the id both registers key on. |
| `ImageAnnotation.create(span, geometry, id?)` | A new one: the rect clamped into `[0, 1]²`, the ratios kept positive; **null** when the rect is smaller than a small minimum, so a stray one is not an image. |
| `ImageAnnotation.restore(stored)` | Rebuild one from what was written down; null when it is not an image to draw. |
| `isUsable` | Is the rect big enough to be worth keeping? |
| `geometry` | the `ImageGeometry` above. |
| `handles()` | the four corners — `nw`, `ne`, `se`, `sw`. |
| `withHandle(end, to, options?)` | Resize from the opposite corner: keep proportions by default, free when `options.free`. |
| `movedBy(dx, dy)` | Shift the rect, clamped so the whole rect stays inside the picture. |
| `withSpan(span)` | The same rect over a different stretch — never makes it unusable. |
| `duplicated(span)` | A new id over the **same** `imageId` and rect — a copy copies numbers, not bytes. |
| `hitTest(x, y, w, h, tolerancePx)` | Inside the rect (in the picture's pixels). |
| `stored()` | The `ImageGeometry` under `geometry`. |

**Rules**

- **Keep proportions** (spec FR-015, clarification Q2): given a new width fraction `w`
  from the drag, `height = w · pictureAspect ÷ imageAspect`; the opposite corner is the
  anchor.
- **Free resize**: `height` comes from the drag; the opposite corner is still the
  anchor.
- **A drag past the anchor** is clamped to a minimum rect rather than flipped into a
  negative one.
- A rect dragged past the picture's edge is kept, pulled inside — it is not lost (the
  same rule the arrow has for its ends).
- A damaged stored image reads back as nothing rather than throwing.
- **No bytes, no canvas**: the kind is numbers and an id, so `src/domain/` stays pure
  (Principle II).

## New entity — the `AnnotationPlugin` (the view seam)

`src/ui/annotating/annotation-plugin.ts`

```ts
export interface AnnotationAction {
  readonly label: string;   // 'Arrow' | 'Image' — what the section's button says
  readonly title: string;   // its tooltip
  readonly icon: string;    // its inline svg
}

export interface AnnotationPlugin {
  readonly id: string;                          // the domain kind's id
  readonly action: AnnotationAction;
  readonly renderer: AnnotationRenderer<Annotation>;  // how it is drawn (unchanged type)
  /** Begin making one over the selected stretch. */
  begin(ctx: CreationContext): void;
}

export interface CreationContext {
  readonly span: Span;                           // the stretch the annotation is shown over
  readonly picture: { readonly w: number; readonly h: number };  // the picture's pixels
  /** Ask the canvas for a drag across the picture; null when it was abandoned. */
  drag(
    build: (from: Point, to: Point) => Annotation | null,
    minLength?: number,
  ): Promise<{ from: Point; to: Point } | null>;
  /** Show this while it is being made, or clear it with null. */
  draft(annotation: Annotation | null): void;
  /** It is made: the clip takes it and it is put in hand. */
  commit(annotation: Annotation): void;
  /** Nothing to make; say what to do instead. */
  abandon(message: string): void;
  /** Say something under the timeline while the kind is busy. */
  say(message: string): void;
}
```

**Rules**

- a plugin is **view** code and may attach its own listeners (the image's paste and
  drop) — that is the spec's "some interactivity if needed" (FR-013);
- the registry is keyed by the kind's id, and `pluginOf(id)` / `plugins()` are the whole
  of what the canvas and the marks ask it;
- a kind with no plugin is not offered in the section's actions and is not created; it
  still draws if a clip carries it and a renderer exists (spec FR-012, the
  forward-compatibility rule the register already has).

## Changed entity — the shared canvas

`src/ui/annotating/annotation-canvas.ts` (from `annotation-edit.ts`)

Holds, for its lifetime (the session ends it):

| Piece | Meaning |
|---|---|
| `armed` | the plugin whose creation is in flight, or null |
| `pickId`, `grab`, `last` | the annotation in hand, what is being dragged (a handle or the whole thing), and where the pointer last was |
| `add(kindId, span)` | asks the kind's plugin to begin — the section's action calls this |
| `down/move/end` | pointer plumbing: a creation drag goes to the armed plugin's `drag`; otherwise pick, move, resize (with the modifier), or a control |
| `pick/forget/cancel` | the selection, as today |
| `preview()` | the draft the plugin is showing, for the layer to draw |

**Rules**

- the canvas names **no kind**: every operation is `annotation.movedBy(...)`,
  `annotation.withHandle(end, to, { free })`, `annotation.hitTest(...)`,
  `annotation.duplicated(...)`, and the clip's own add/change/remove/undo;
- the modifier (`Shift`) is read here and passed as `options.free`; what it means is the
  kind's rule (D4, D6);
- copy, paste, delete and undo are the ones the arrow has today, unchanged and shared
  (spec FR-005, FR-006, FR-007).

## New entity — the image store and its cache

`src/infra/images.ts`; the port in `application/ports/ImageStorePort.ts`

```ts
export interface StoredImage {
  readonly id: string;
  readonly blob: Blob;
}

export interface ImageStorePort {
  /** Write a picture once, under its id. */
  put(id: string, blob: Blob): Promise<void>;
  /** Every kept picture, for a restore. */
  all(): Promise<StoredImage[]>;
}
```

The adapter, `src/infra/images.ts`, also holds the **decoded cache**:

| Piece | Meaning |
|---|---|
| `images.put(id, blob)` | writes the picture to the `images` store **and** decodes it into the cache |
| `images.get(id)` | the decoded picture for drawing, or null when it is not there yet |
| `images.ready()` | resolves when every kept picture is decoded — the export awaits this |
| `images.clear()` | lets the store and the cache go with the clip |

**Rules**

- the picture is written **once**, apart from the small half, exactly as a take is;
- `imageId` is made like an annotation id, and is unique for the session;
- a picture that cannot be read is refused with a message and nothing is added (spec
  edge case);
- a picture larger than twice the clip's picture is downscaled once, on add (D10);
- the cache holds one decoded picture per id, so a frame draws a `drawImage`, not a
  decode (spec SC-008).

## Changed entity — the clip store

`src/infra/clip-store.ts`

| Change | Meaning |
|---|---|
| `DB_VERSION` 2 → 3 | a third object store, `images` |
| `images` store | key `imageId`, value the `Blob` |
| `clear()` | clears takes, meta **and** images — the clip is gone |

The **small half** (`Meta.annotations`) is unchanged in shape: an image annotation's
`geometry` is still plain numbers plus an `imageId`, so a change still writes a few
bytes and never the picture.

## Changed entity — the stored shape

`StoredAnnotation.geometry` is already `unknown`, so no shape change is needed; the two
kinds write:

```ts
// arrow (unchanged)
geometry: { from: { x, y }, to: { x, y } }

// image (new)
geometry: { imageId, x, y, width, height, imageAspect, pictureAspect }
```

**Rules**

- a stored clip from a version without images reads back unchanged (its annotations are
  arrows);
- a stored image whose picture is missing from the `images` store draws nothing and does
  not fail the open — the annotation is kept, its picture is simply not there;
- `kinds.ts` registers `ImageAnnotation` beside `Arrow`, so `annotationFrom` rebuilds
  both.

## View state (not the clip's)

| Piece | Where | Lifetime |
|---|---|---|
| the armed plugin and the drag in flight | `annotation-canvas.ts` | the gesture / the session |
| the `Clipboard` | `annotation-clipboard.ts` (unchanged) | the session |
| the decoded cache | `infra/images.ts` | the session |

## State transitions

| From | Event | Effect |
|---|---|---|
| a clip in review, a stretch selected | the **Arrow** action is pressed, then a drag | `ArrowPlugin.begin` → `drag` → `commit` → `clip.addAnnotation` → `annotation-added`; the section is spent; one undo is now "the arrow" |
| a clip in review, a stretch selected | the **Image** action is pressed, then a picture is chosen | `ImagePlugin.begin` → `images.put(id, blob)` → `commit` → `clip.addAnnotation` → `annotation-added`; the meta write carries the `imageId`; the picture is already written |
| a clip with any annotation | it is picked and dragged | `changeAnnotation` → `annotation-changed`; one undo puts the previous geometry back |
| a clip with an image | a corner is dragged | `withHandle(end, to, { free })` — keep-proportions by default, free with the modifier; `annotation-changed` |
| a clip with any annotation | it is deleted | `removeAnnotation` → `annotation-removed`; one undo puts it back (and its picture was never let go — D12) |
| a clip with any annotation | a cut is approved | the model is unchanged; the `TimelineMap` stops showing the cut part; `lastChange` becomes the cut |
| a clip with any annotation | a new take is recorded | `addTake` re-bases every span, so each stays over its moments |
| a clip with annotations | the page reloads / the publish sign-in returns | `restore()` rebuilds the annotations; the resume flow decodes the kept pictures into the cache |
| a clip with annotations | the session ends (New, or an export) | `clear()` drops the annotations with the cuts; the images store and the decoded cache go too |
