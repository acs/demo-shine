# Implementation Plan: Video Annotations

**Branch**: `feat/video-annotations` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-video-annotations/spec.md`

## Summary

Add **annotations** to the clip: things drawn over the picture for a stretch of its
time. The first kind is the **arrow**, drawn onto a detail so the eye lands on it.
The annotation family must be extensible — a second kind (a box, a label, a
highlight) is added by describing it, not by reworking the arrow — and the stretch
an annotation is shown over is chosen with the **same selection that already bounds
a cut**, so there is one way to point at a stretch of the clip.

The technical approach follows this repository's hexagonal shape. The annotations
become part of the **`Clip` aggregate** beside the cuts, as an identity-bearing
`AnnotationSet` that is serialised in the clip snapshot and kept by the clip store
the same way the cuts are (a few bytes, never the recording). Each kind is a
**pair of descriptors under one id** — a pure domain descriptor (how a geometry is
normalised, whether it is worth keeping) and a view renderer (how it is drawn, hit
and handled) — so a new kind is new files plus a registry entry, and nothing that
already exists changes. Drawing is shared: **one layer** paints the annotations over
the preview during playback and over the export canvas during the offline encode,
which is what makes the file match the review. The pending section that
`ui/marks.ts` owns today is extracted into a **`Selection`** the Cut and Annotate
actions both read.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), ES modules, `import type` for types

**Primary Dependencies**: Vite 8 (dev server + build), Mediabunny + WebCodecs (the
offline export), no runtime framework — the DOM and Canvas are the UI

**Storage**: IndexedDB (`src/infra/clip-store.ts`) for the clip that outlives the
page; `localStorage` for preferences only

**Testing**: Vitest, unit tests beside every rule in `src/domain/` and
`src/application/`; temporary `verify-*.html` browser harnesses on the dev server for
anything drawn, played or encoded

**Target Platform**: evergreen browsers; Chrome/Edge 94+, Firefox 130+, Safari 26+
(the export needs WebCodecs)

**Project Type**: single-project browser application (hexagonal: `domain/` pure,
`application/` use cases, `infra/` + `ui/` adapters, flows at the root)

**Performance Goals**: playback stays at the clip's frame rate with annotations
drawn each frame; the export stays ~10× real time — annotations are vector draws on
a canvas that is already being drawn into

**Constraints**: `src/domain/` must not import the DOM or the browser; the recording
is never re-encoded (an annotation is a draw, not a byte); an annotation change
writes a few bytes, never the recording

**Scale/Scope**: a handful of annotations per clip; one new kind shipped (the arrow),
the family ready for the next; three new domain modules and a small number of view
modules

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The spec-kit constitution at `.specify/memory/constitution.md` is the **unfilled
template** — this project's governance is written in `.agents/skills/` and
`GLOSSARY.md` instead. The gates below are taken from those, and each is checked
against the design.

| Gate (from the repo's own rules) | Status | How the design meets it |
|---|---|---|
| `src/domain/` is pure — no DOM, no browser API | PASS | `Annotation`, `AnnotationSet` and the arrow kind are plain values and rules; drawing, hit-testing and gestures live in `ui/` |
| A rule in `domain/` has a unit test beside it | PASS | `Annotation.test.ts`, `AnnotationSet.test.ts`, the arrow kind's test, and the new `Clip` tests (see `quickstart.md`) |
| Collaborators behind a port | PASS | a kind is a descriptor the domain and the view each implement; the view registry is the seam a new kind plugs into |
| The view listens; no caller re-renders around a call | PASS | the clip announces `annotation-added/changed/removed`; the layer, the lane and the marks react |
| A new concept is named in `GLOSSARY.md` first | PASS (task 1) | `annotation`, `annotation kind`, `arrow`, and the widened `selection` are written there before the code |
| One change per pull request; CI owns the version | PASS | the task breakdown is ordered as separate pull requests; no `package.json` bump |
| State that has a lifetime is an object, ended by the session | PASS | the arrow gesture in flight is an object (like `MarkDrag`/`CropDrag`); `session.reset()` cancels it |
| Verification level stated per change | PASS | domain rules → unit tests; the layer, the lane, the gestures and the export → browser harness (see `quickstart.md`) |

No violations; **Complexity Tracking is empty** (below).

## Project Structure

### Documentation (this feature)

```text
specs/001-video-annotations/
├── plan.md              # This file
├── research.md          # Phase 0 — the decisions and why
├── data-model.md        # Phase 1 — the entities and their rules
├── quickstart.md        # Phase 1 — how to prove it works
├── contracts/           # Phase 1 — the extensibility seam, spelled out
│   ├── annotation-kind.md
│   └── clip-annotations.md
├── checklists/
│   └── requirements.md  # from /speckit.specify
└── tasks.md             # Phase 2 — /speckit.tasks (not created here)
```

### Source Code (repository root)

```text
src/
├── domain/
│   ├── annotation/                 # NEW — the family, pure
│   │   ├── Annotation.ts           #   one annotation: id, kind, span, geometry
│   │   ├── Annotation.test.ts      #   (beside it, as everywhere in domain/)
│   │   ├── AnnotationSet.ts        #   the clip's annotations: identity, add/change/remove
│   │   ├── AnnotationSet.test.ts
│   │   ├── Arrow.ts                #   the arrow kind: its geometry and its rules
│   │   ├── Arrow.test.ts
│   │   └── kinds.ts                #   the registry the domain validates through
│   └── clip/
│       ├── Clip.ts                 # CHANGED — holds the AnnotationSet, one undo, events
│       ├── Clip.test.ts            # CHANGED — annotations, undo across kinds, cuts
│       └── ExportPlan.ts           # CHANGED — carries the annotations to draw
├── ui/
│   ├── selection.ts                # NEW — the pending section, extracted from marks.ts
│   ├── annotation-layer.ts         # NEW — draw annotations on a canvas (preview + export)
│   ├── annotation-edit.ts          # NEW — place/pick/drag on the picture (a gesture object)
│   ├── annotation-lane.ts          # NEW — the timeline lane that shows the stretches
│   ├── marks.ts                    # CHANGED — reads the Selection; the Cut action
│   ├── playback.ts                 # CHANGED — draws the layer each frame
│   ├── timeline-ui.ts              # CHANGED — the lane redraws with the strip
│   ├── dom.ts                      # CHANGED — the new elements
│   └── ...
├── infra/
│   └── clip-store.ts               # CHANGED — annotations in the meta record
├── state.ts                        # CHANGED — the arrow gesture's view state
├── session.ts                      # CHANGED — cancel the arrow gesture on reset
├── offline-export.ts               # CHANGED — draws the layer on the export canvas
├── resume.ts                       # CHANGED — annotations ride the existing meta save
├── main.ts                         # CHANGED — wire the gesture and the lane
├── index.html                      # CHANGED — the Annotate action, the timeline lane
├── styles.css                      # CHANGED — the lane and the action
├── GLOSSARY.md                     # CHANGED — the new words, first
├── FEATURES.md, README.md          # CHANGED — the feature, in the list and the usage
```

**Structure Decision**: the repository's existing hexagonal layout is kept. The
rules go in `src/domain/annotation/` (pure, tested in node); the drawing and the
gestures go in `src/ui/` (the browser boundary), with **one** layer module shared by
playback and the export so an annotation looks the same in both; persistence reuses
the clip store's existing split (the recording once, the small half on every change).

## Complexity Tracking

> No constitution violations. Nothing to justify.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| —         | —          | —                                    |
