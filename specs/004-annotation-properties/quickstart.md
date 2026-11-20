# Quickstart — proving the properties inspector works

How to check the change end-to-end, and what each check is worth. The rules are in
`data-model.md`; the seam is in `contracts/annotation-property.md`; the sequence is in
`plan.md`.

## Prerequisites

```bash
npm install
```

## 1. The rules — unit tests, in node

```bash
npx vitest run src/domain/annotation     # the palette, withColour, withWords, stored/restore
npx vitest run src/ui/annotating         # the property list each plugin declares
npx vitest run src/domain/clip           # the aggregate: annotations, one undo, cuts
```

**What must pass**

- `colourOf` takes every palette entry and answers the fallback for anything else —
  `undefined`, `''`, a colour from a later version, a damaged value;
- `Arrow.withColour` and `TextAnnotation.withColour` keep the shape, the span and the id,
  and an arrow or text whose stored geometry has no colour reads back in its default;
- `TextAnnotation.withWords`:
  - keeps the anchor and the font size and sets the width when the words fit;
  - shrinks both by one factor when the measured width would run past the picture from
    the anchor, and the anchor does not move;
  - keeps the colour, the span and the id;
  - refuses empty words (through `create`);
- `stored()` writes the colour and `restore` reads it, for both kinds;
- the arrow plugin declares `colour`, the text plugin declares `colour` and `words`, and
  the image plugin declares none;
- the existing `Arrow`, `ImageAnnotation`, `TextAnnotation`, `AnnotationSet`, `Clip` and
  `ExportPlan` tests pass **unmodified** — the colour is optional with a default, so
  their `toMatchObject` assertions still hold. If one had to change, the behaviour
  changed and that is decided deliberately and said out loud.

**What this does not prove**: the settings control, the popover, the swatches, the text
entry and what a person sees — those are the harness's, below.

## 2. What a person sees — a browser harness

Write a temporary `verify-properties.html` at the repo root (a copy of `index.html` with
a module script injected before `</body>`), build the state by hand rather than recording
it, report through a `<pre id="verify">`, and open it on the running dev server:

```bash
npm run dev     # http://127.0.0.1:5173
```

Build the clip by hand (`session.clip.clear()`, `addTake(blob, 4)`, add an arrow and a
text, `setPhase('review')`) and assert what a person would see:

| Scenario | Assert |
|---|---|
| The settings control | an arrow picked shows it; the **image** picked does not (no properties); it sits off the annotation's middle (FR-006, FR-009, D8) |
| Open and close | pressing it opens the popover beside the annotation; pressing again, Escape, an outside click and a resize close it (FR-015) |
| The colour row | the arrow's popover shows the palette with its current colour marked; pressing another applies at once and the popover stays open (FR-011) |
| Playback and export | after a colour change, the same colour is drawn in playback and on `exportOffline`'s canvas — one renderer, one answer (FR-002, SC-002) |
| Undo | one undo puts the previous colour back, and the picture, playback and the label follow (FR-003, SC-004) |
| The words row | a text's popover shows its words; editing them opens the one entry; confirming changes the text (FR-012) |
| The box follows | longer words widen the box; words too long to fit shrink the font with the box's top-left unmoved; the whole box stays inside the picture (FR-012, SC-003) |
| An empty entry | confirming empty words changes nothing and says why (FR-014) |
| A cancelled entry | the picture and the words are exactly as they were (Q3) |
| Creating a text | the text kind no longer opens a browser prompt; it uses the same entry, and the harness's stub of it is what makes a line (FR-013) |
| Picking another | the popover closes with the first annotation; the second opens from its own control (FR-016) |
| No property shows another's | picking the image shows no colour row, and picking the text shows the text's colour, not the arrow's (FR-008, SC-007) |

The harness cannot decode a real WebM (`duration = 0`); model the element
(`currentTime`, `paused`, `seeking`, dispatching `seeked`) as the existing harnesses do,
and re-route `requestAnimationFrame` before importing, because the panel is backgrounded.
Stub the text entry (it is a dialog) and feed it a line, as the text harness did with
`prompt`.

**Delete `verify-properties.html` before committing** — it is evidence, pasted into the
pull request, never part of the change.

## 3. The reload, in the running app

In the running app (not the harness): change an arrow's colour and a text's words,
reload the page, and confirm both come back as they were. This is the one check that
needs the real IndexedDB path (the clip store's small half).

## 4. What cannot be checked here

- **The recorder's flow** (a real screen share) — untouched by this change; the user runs
  it.
- **The exported file's exact pixels** — the harness asserts the renderer ran with the
  chosen colour on the export canvas, not the encoded result.
- **A real reload with a real recording** — the harness builds its clip by hand.
- **The real focus and blur of the text input** — the harness stubs the entry; typing in
  the real dialog is the user's to run.

## Reporting

In the pull request: the unit-test output, the harness output pasted in, and the words of
the Verification skill — which level each part got, and what was not verified and why.
Where an existing test changed, name it and say why.