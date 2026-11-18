# Contract — the clip's annotations

What the rest of the app may ask of the clip about annotations, and what the clip
announces. Everything here is what the view and the flows are written against; the
rules behind it are in `data-model.md`.

## The `Clip` methods

```ts
/** What is drawn over the clip, as fractions of its time. */
get annotations(): AnnotationSet;

/** A new annotation, at the end of the order. Announces `annotation-added`. */
addAnnotation(annotation: Annotation): void;

/** Replace one, keeping its id. Announces `annotation-changed`. */
changeAnnotation(id: string, next: Annotation): void;

/** Take one out. Announces `annotation-removed`. Returns what was removed. */
removeAnnotation(id: string): Annotation | null;

/** The annotations shown at a moment of the recording, in draw order. */
annotationsAt(sourceSeconds: number): readonly Annotation[];

/** One undo, over the last change of any kind (spec FR-015). */
canUndo(): boolean;
undo(): UndoResult | null;      // reports what it reversed, so the header can say it
```

**Guarantees**

- `addAnnotation` refuses an `id` already in the set; a kind's geometry is normalised
  before it is stored.
- `annotationsAt` decides visibility through the clip's `TimelineMap`, so a moment
  inside a cut shows nothing (FR-014) and no caller re-implements the mapping.
- every change re-bases nothing and rewrites nothing about the recording; the
  recording is never touched (FR-012).
- `addTake` re-bases every annotation's span, as it already does for the cuts.

## The events (`ClipEvent`)

```ts
| { type: 'annotation-added';   annotation: Annotation }
| { type: 'annotation-changed'; annotation: Annotation; previous: Annotation }
| { type: 'annotation-removed'; annotation: Annotation }
```

**Guarantees**

- listeners are told on a copy of the set, so one may unsubscribe while it runs;
- the view reacts to these and does **not** re-render because it was the caller — the
  layer, the timeline lane and the marks all listen (the repository's rule);
- the persistence flow (`resume.ts`) writes the small half on any of them, through the
  path it already uses for cuts.

## The stored shape

```ts
// in ClipSnapshot, and in the clip store's Meta record
interface StoredAnnotation {
  id: string;
  kind: string;                         // 'arrow'
  s: number; e: number;                 // the span, fractions of the clip
  geometry: { from: { x: number; y: number }; to: { x: number; y: number } };
}
```

**Guarantees**

- a stored clip from a version without annotations reads back as none (the field is
  absent), and a stored clip with an unknown kind keeps its data and simply draws
  nothing — `kindOf` returns `null` rather than throwing.
- the record is written in the same transaction path as the cuts; the recording is
  written once, when the take arrives.
