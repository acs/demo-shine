# Quickstart — proving the annotations work

How to check the change end-to-end, and what each check is worth. The rules are in
`data-model.md`; the seam is in `contracts/`.

## Prerequisites

```bash
npm install
```

## 1. The rules — unit tests, in node

The domain rules are proved by tests beside them, with no browser:

```bash
npx vitest run src/domain/annotation          # the family: Annotation, AnnotationSet, Arrow
npx vitest run src/domain/clip/Clip.test.ts   # the aggregate: annotations, one undo, cuts
npx vitest run src/domain/clip/ExportPlan.test.ts
```

**What must pass**

- an `AnnotationSet` will not take a duplicate id, and does allow two spans that
  overlap (unlike `SpanSet`);
- the arrow kind clamps a geometry drawn past the edge into `[0, 1]²`, and rejects a
  zero-length one as unusable;
- `Clip.addTake` re-bases an annotation's span, so it stays over the moments it was
  placed on (the same assertion the cuts already have);
- `Clip.undo()` takes back the last change of **any** kind — a cut, an arrow added, an
  arrow removed, an arrow changed — one action each (FR-015);
- a cut that removes an annotation's whole stretch leaves `annotationsAt` empty for
  that moment, and putting the cut back brings it back (FR-014);
- `snapshot()`/`restore()` round-trip the annotations.

**What this does not prove**: anything about how an arrow looks, or that the export
draws it — those are the harness's, below.

## 2. What a person sees — a browser harness

Write a temporary `verify-annotations.html` at the repo root (a copy of `index.html`
with a module script injected before `</body>`), build the state by hand rather than
recording it, report through a `<pre id="verify">`, and open it on the running dev
server:

```bash
npm run dev     # http://127.0.0.1:5173
```

Build the clip and the annotations by hand — `app.clip.clear()`,
`app.clip.addTake(blob, 4)`, `app.clip.addAnnotation(...)`, `app.phase = 'review'` —
and assert what a person would see:

| Scenario | Assert |
|---|---|
| Playback over an arrow's stretch | the layer's `drawImage`/stroke work happens while the playhead is inside the span, and not outside it (FR-005) |
| The arrow over a moving picture | the drawn geometry is the same fractions at the start and the end of the span (SC-003) |
| The export | run `exportOffline(planExport(app.clip, …))`; the same renderer is called on the export canvas, so the file carries the arrow (FR-006, SC-002) |
| The timeline lane | a mark exists per annotation at the start of its **kept** stretch, and clicking it picks that arrow and moves the playhead (FR-016, SC-007) |
| Pick and drag | a click on the arrow picks it; dragging an end changes `to`; dragging its span changes `s`/`e` (FR-007) |
| Delete and undo | the arrow disappears, the header's undo says what it will take back, and one press brings it back (FR-008, FR-015) |

The harness cannot decode a real WebM (`duration = 0`); model the element
(`currentTime`, `paused`, `seeking`, dispatching `seeked`) as the existing harnesses
do, and re-route `requestAnimationFrame` before importing, because the panel is
backgrounded.

**Delete `verify-annotations.html` before committing** — it is evidence, pasted into
the pull request, never part of the change.

## 3. The reload

In the running app (not the harness): place an arrow, reload the page, and confirm the
arrow is back over the same detail for the same stretch — the clip store's small half
(SC-006). This is the one check that needs the real IndexedDB path.

## What cannot be checked here

- **The recorder's flow** (starting a screen share, a take arriving) needs a real user
  gesture and a browser picker — no harness can start a share. This change does not
  touch that flow; it stays small and the user runs it.
- **The exported file's exact pixels** are not asserted — the harness asserts the
  renderer ran on the export canvas, not the encoded result.
- **A real reload with a real recording** is the user's to run; the harness builds its
  clip by hand.

## Reporting

In the pull request: the unit-test output, the harness output pasted in, and the words
of the Verification skill — which level each part got, and what was not verified and
why.
