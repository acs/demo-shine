# Quickstart — proving the annotation plugins work

How to check the change end-to-end, and what each check is worth. The rules are in
`data-model.md`; the seam is in `contracts/`; the sequence is in `plan.md`.

## Prerequisites

```bash
npm install
```

## 1. The rules — unit tests, in node

The domain rules are proved by tests beside them, with no browser:

```bash
npx vitest run src/domain/annotation            # the family: Annotation, Arrow, ImageAnnotation, AnnotationSet
npx vitest run src/domain/clip/Clip.test.ts     # the aggregate: annotations, one undo, cuts
npx vitest run src/domain/clip/ExportPlan.test.ts
```

**What must pass**

- the `ImageAnnotation` rules, each with its own test:
  - `create` clamps a rect drawn past the edge into `[0, 1]²` and refuses a rect below
    the minimum as unusable;
  - a keep-proportions resize solves `height = width · pictureAspect ÷ imageAspect`, with
    the opposite corner fixed;
  - a free resize takes the height from the drag, the opposite corner still fixed;
  - a drag past the anchor clamps to a minimum rect rather than flipping it negative;
  - `movedBy` shifts the rect and pulls it back inside the picture;
  - `hitTest` is true inside the rect and false outside it;
  - `duplicated` carries the same `imageId` under a new id;
  - `stored()`/`restore()` round-trip the geometry, and a damaged one reads back as
    nothing;
- the arrow and the cut rules are **the regression proof** for the seam: the same tests
  pass unmodified, except where an equivalent implementation was needed — and where a
  test had to change, the pull request says which and why (spec SC-003, the stated
  departure);
- `Annotation.withHandle(end, to, options?)` still accepts a call with no third
  argument — the arrow's tests use it;
- `clip.undo()` still takes back the last change of **any** kind — a cut, an annotation
  added, removed or changed — one action each.

**What this does not prove**: anything about how an image is chosen, drawn or picked,
or that the export draws it — those are the harness's, below.

## 2. What a person sees — a browser harness

Write a temporary `verify-annotations.html` at the repo root (a copy of `index.html`
with a module script injected before `</body>`), build the state by hand rather than
recording it, report through a `<pre id="verify">`, and open it on the running dev
server:

```bash
npm run dev     # http://127.0.0.1:5173
```

Build the clip by hand — `session.clip.clear()`, `session.clip.addTake(blob, 4)`,
`session.clip.addAnnotation(...)`, `setPhase('review')` — and assert what a person
would see (`app` is gone since `refactor/hexagonal-shared-modules`; the clip is on
`session`):

| Scenario | Assert |
|---|---|
| The section's actions | an **Arrow** and an **Image** button exist, built from the plugins, and pressing one arms that kind (FR-022) |
| Making an arrow | a drag across the picture commits an arrow, a stray click is refused with the message, and the arrow shows over its stretch in playback (FR-001, FR-002) |
| Making an image | a chosen picture is placed, drawn through the layer, and shown over its stretch in playback; a bad file is refused with a message and nothing is added (FR-014, spec edge case) |
| The shared operations | picking either kind shows the same grips and controls; dragging the body moves it; dragging a handle resizes it (the arrow along its length, the image by a corner); copy and paste make a new one of the same kind; Delete and the × remove it; one undo brings it back (FR-001 … FR-007) |
| The image's proportions | dragging a corner keeps the picture's proportions; with the modifier it stretches (FR-015) |
| The export | run `exportOffline(planExport(app.clip, …))` after awaiting `images.ready()`; the same renderers are called on the export canvas, so the file carries the image and the arrow (FR-011, SC-005) |
| The timeline lane | a mark exists per annotation at the start of its **kept** stretch, with the kind's symbol; clicking it picks that annotation and moves the playhead (spec FR-016) |
| The reload | a picture put in the store comes back decoded into the cache, and a restored image draws without being chosen again (FR-016, SC-006) |

The harness cannot decode a real WebM (`duration = 0`); model the element
(`currentTime`, `paused`, `seeking`, dispatching `seeked`) as the existing harnesses
do, and re-route `requestAnimationFrame` before importing, because the panel is
backgrounded. Stub `createObjectURL`/revoke and count them to check the cache lets a
picture go with the session.

**Delete `verify-annotations.html` before committing** — it is evidence, pasted into
the pull request, never part of the change.

## 3. The reload, in the running app

In the running app (not the harness): place an image over a stretch, reload the page,
and confirm the image is back in place and drawn without being chosen again. This is
the one check that needs the real IndexedDB path (`images` store + small half).

## 4. What cannot be checked here

- **The recorder's flow** (starting a screen share, a take arriving) needs a real user
  gesture and a browser picker — no harness can start a share. **This change does not
  touch that flow**; it stays small and the user runs it.
- **The exported file's exact pixels** are not asserted — the harness asserts the
  renderers ran on the export canvas, not the encoded result.
- **A real reload with a real recording** is the user's to run; the harness builds its
  clip by hand.
- **A real picture from the platform's picker or a real OS drag** is the user's to run;
  the harness feeds a `Blob` directly.

## Reporting

In the pull request: the unit-test output, the harness output pasted in, and the words
of the Verification skill — which level each part got, and what was not verified and
why. Where an existing arrow or cut test changed, name it and say why (spec SC-003).
