# Phase 1 — Data Model

The entities the feature adds or changes, their fields, the rules they enforce, and
how they move. Field names are the ones the code will use; the words are the ones
`GLOSSARY.md` will gain first.

## New entities

### `Annotation` — the base class

`src/domain/annotation/Annotation.ts`

| Member | Meaning |
|---|---|
| `id` | Identity, so a specific annotation can be picked, changed and undone. Made once, at creation. |
| `span` | **When** it is shown, as fractions of the clip (`[0, 1]`), like a cut. A `Span`, so an out-of-order pair cannot be built. |
| `kind` | Which kind it is — `'arrow'` today. The id both registries key on. |
| `handles()` | The points a drag can take hold of, in fractions of the picture. |
| `withHandle(end, to)` | The same annotation with one handle moved; null if that is not one of its handles. |
| `movedBy(dx, dy)` | The same annotation, shifted — how it is moved whole. |
| `withSpan(span)` | The same annotation over a different stretch — how it follows a clip that grew. |
| `hitTest(x, y, w, h, tolerancePx)` | Is a point on it? Pure geometry, no canvas. |
| `stored()` | The annotation as it is written down. |

A kind is a **subclass** of it, and the class **is** the kind: a static `id` names
it and a static `restore` rebuilds one, which is what `kinds.ts` registers.

### `Arrow` — the first kind

`src/domain/annotation/Arrow.ts` — `class Arrow extends Annotation`

| Member | Meaning |
|---|---|
| `from`, `to` (`Point`) | The tail and the head, in fractions of the picture. |
| `Arrow.create(span, from, to, id?)` | A new arrow, both ends clamped into `[0, 1]²`; **null** when they are closer than a small minimum, so a stray click is not an arrow. |
| `isUsable` | Is this worth keeping, or a stray click? |
| `geometry` | `{ from, to }`. |
| `Arrow.restore(stored)` | Rebuild one from what was written down; null when it is not an arrow to draw. |

**Rules**

- an arrow drawn past the edge is kept, pulled to the edge — it is not lost (spec
  edge case);
- a change of stretch never makes an arrow unusable — the ends are untouched;
- a damaged stored arrow reads back as nothing rather than throwing.

### `AnnotationSet` — the clip's annotations

`src/domain/annotation/AnnotationSet.ts`

Holds an ordered collection of `Annotation`, keyed by `id`.

**Rules**

- **Identity**: an `id` appears at most once; `add` refuses one already present.
- **Overlap is allowed** — unlike `SpanSet` (the cuts), which merges and forbids
  overlap. Two annotations may cover the same moment; they are different things drawn
  on top of each other (spec edge case, FR-009). This is a deliberate difference from
  the cuts and is stated here so it is not "fixed" later.
- `at(moment)` returns the annotations whose span contains that moment, in a stable
  order (by span start, then by id) so the draw order does not flicker.
- `change(id, next)` replaces one, keeping its identity; `remove(id)` takes one out and
  returns it; both refuse an unknown `id` rather than throwing.
- `rebase(factor)` multiplies every span, for a new take — the same re-base the cuts
  get, so an annotation stays over the moments it was placed on.

## Changed entities

### `Clip` — the aggregate

`src/domain/clip/Clip.ts`

| Addition | Meaning |
|---|---|
| `annotations: AnnotationSet` | the clip's annotations, beside the cuts |
| `addAnnotation(a)` / `changeAnnotation(id, next)` / `removeAnnotation(id)` | the changes, each announcing an event |
| `lastChange` (replaces `lastApproved`) | the single thing the one undo takes back — a cut, or an annotation added/changed/removed |
| `canUndo()` / `undo()` | unchanged in shape; `undo()` reports what it reversed |

**Rules**

- A new take re-bases the annotations' spans exactly as it re-bases the cuts
  (`addTake`), so they stay over the same moments.
- `clear()` empties the annotations with the cuts.
- `snapshot()` carries the annotations; `restore()` rebuilds them, and — like the cuts
  — announces nothing (a restore is a load, not a change).
- An annotation whose span is entirely inside a cut is not shown, and is not removed
  from the model (putting the cut back brings it back) — visibility is decided by the
  `TimelineMap`, not by deleting data.

### `ClipSnapshot` — what is written down

`src/domain/clip/Clip.ts`, kept by `src/infra/clip-store.ts`

```ts
interface ClipSnapshot {
  takes: ReadonlyArray<{ blob: Blob; duration: number }>;
  cuts: ReadonlyArray<{ s: number; e: number }>;
  annotations: ReadonlyArray<StoredAnnotation>;   // NEW — the small half, like cuts
}
```

The store's `Meta` record gains the same `annotations` array, so a change writes a few
bytes and never the recording.

### `ExportPlan` — what the file will hold

`src/domain/clip/ExportPlan.ts`

| Addition | Meaning |
|---|---|
| `annotations: readonly Annotation[]` | carried from the clip, so the export can draw them |

`ExportPlan` stays a value decided in node; it carries the annotations as data, and
the **view** draws them (the domain does not know what an arrow looks like).

## View state (not the clip's)

### `Selection` — the stretch the user is pointing at

`src/ui/selection.ts` (extracted from `ui/marks.ts`)

| Piece | Meaning |
|---|---|
| `marks: number[]` | up to two marks, fractions of the clip (moved here from `app.marks`) |
| `section(): Span \| null` | the span the two marks bound, or null — what a Cut or an Annotate action consumes |

### The arrow gesture

`src/ui/annotation-edit.ts` — an object with a lifetime (like `MarkDrag` / `CropDrag`):
where the pointer went down, where it is, and whether the gesture is a fresh arrow or
a drag of an existing one. `session.reset()` cancels it.

## State transitions

| From | Event | Effect on annotations |
|---|---|---|
| a clip in review, a section selected | the user draws an arrow | `addAnnotation` → `annotation-added`; the section is consumed; one undo is now "the arrow" |
| a clip with an arrow | the user picks it and drags an end | `changeAnnotation` → `annotation-changed`; one undo puts the previous geometry back |
| a clip with an arrow | the user deletes it | `removeAnnotation` → `annotation-removed`; one undo puts it back |
| a clip with an arrow | the user approves a cut | the annotations are unchanged in the model; the `TimelineMap` stops showing the cut part; `lastChange` becomes the cut (the arrow's own undo is no longer the one on offer) |
| a clip with an arrow | a new take is recorded | `addTake` re-bases every span, so each arrow stays over its moments |
| a clip with annotations | the page reloads / the publish sign-in returns | `restore()` rebuilds them; nothing is announced |
| a clip with annotations | the session ends (New, or an export) | `clear()` drops them with the cuts; the kept copy goes too |
