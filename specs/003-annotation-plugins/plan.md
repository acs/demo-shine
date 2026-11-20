# Implementation Plan: Annotation Plugins

**Branch**: `feat/annotation-plugins` | **Date**: 2026-11-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-annotation-plugins/spec.md`

## Summary

Turn the arrow's private editing into a **shared annotation canvas** that every kind
gets for free — select, move, resize, copy, delete, undo — and make a kind a **plugin**
that describes only its own shape, how it is drawn, and how a new one is made. The
arrow is rebuilt as the first plugin, with no change to how it behaves; the **image**
kind is added as the second, and as the proof the seam holds. An image's picture is
kept with the clip, apart from the recording, and drawn through one layer so the file
matches the review.

The work ships as a sequence of pull requests, each leaving the app working: the
words first, then the seam extracted from the arrow (behaviour-preserving), then the
image kind in the domain, then where its bytes are kept, then the image plugin in the
view, then the docs.

## Technical Context

**Language/Version**: TypeScript ^6.0.3, ES modules, strict.

**Primary Dependencies**: Vite ^8.3.8 (dev server and build), Vitest ^5.1.0 (node tests), Mediabunny ^1.66.0 (offline export), `@atproto/oauth-client-browser` ^0.5.14 (Bluesky sign-in). **No new runtime dependency**: a picture is decoded with the browser's own `HTMLImageElement` (via an object URL, as `infra/takes.ts` already does) and drawn with `CanvasRenderingContext2D.drawImage`.

**Storage**: IndexedDB, the existing `democlip` database in `src/infra/clip-store.ts`, gaining a third object store `images` for an image annotation's picture (DB version 3). The annotation itself — its id, its stretch and its rect — stays in the **small half** (`Meta`), beside the cuts and the arrow geometries; the picture's bytes are written once, apart, exactly as a take is. No server.

**Testing**: Vitest in node for `domain/` (the new `ImageAnnotation`, and the `Arrow` / `Clip` / `AnnotationSet` tests as the regression proof); a temporary `verify-*.html` harness on the dev server for the canvas, the image plugin, the export and the reload; a real screen share for the recorder's flow, which this change does not touch and the user runs.

**Target Platform**: Modern browsers. Screen capture via `getDisplayMedia`, recording via `MediaRecorder`, export via WebCodecs and Mediabunny, storage via IndexedDB. `drawImage` with an `HTMLImageElement` and an object URL works everywhere the app already runs. Installed as a PWA.

**Project Type**: Single-project browser application (SPA), no backend.

**Performance Goals**: Keep the current capture and export throughput (the offline export measured about 10× real time). A picture drawn scaled each frame must not drop frames: the decoded picture is held once per image id, and a picture larger than twice the clip's picture is downscaled once, when it is added, so the kept clip and the frame cost stay bounded.

**Constraints**: No new runtime dependency. The arrow's behaviour must not change (spec FR-018, SC-003); an existing arrow or cut test may be updated only where the generic seam needs an equivalent implementation, and that is said out loud in the pull request. One step per pull request. CI owns the version; `package.json` is not bumped by hand. The words go into `GLOSSARY.md` before they appear in code. `src/domain/` stays pure — the picture's bytes and its decoding live in `infra/`.

**Scale/Scope**: The annotation family today is four domain modules and four view modules, about 700 lines with tests. This change extracts a plugin seam from the arrow and adds one kind; it touches the domain annotation folder, the `ui/annotating/` folder, the clip store, the section's action row, the export flow, and the docs. It adds no feature to recording, cutting or publishing.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status | Evidence |
|---|---|---|---|
| I. The skills are the constitution | The plan must not disagree with `.agents/skills/` or `GLOSSARY.md`; new words go in the glossary first | PASS | Step 1 adds **annotation plugin**, **annotation canvas**, **image annotation** and **image store** to `GLOSSARY.md` and updates the Overview and Domain model skills before any code moves. The plan follows the Domain model and Verification skills. |
| II. `src/domain/` is pure | No DOM, no browser API, no import from `ui/` or `infra/`; a collaborator is a port | PASS | `ImageAnnotation` is pure geometry (an id, a rect, two ratios) with no bytes and no canvas. The picture's bytes and their decoding live in `infra/images.ts`; the plugin and the canvas live in `ui/`. The domain imports neither. |
| III. Every rule has a test beside it | A rule in `domain/` is proved by a unit test in node; a refactor's proof is the old tests passing unmodified | PASS, with one stated departure | `ImageAnnotation`'s rules (normalise, usable, resize, hit, stored/restore) get unit tests beside them. The `Arrow`, `AnnotationSet` and `Clip` tests are the regression proof. **Departure**: the spec's SC-003 allows an existing arrow or cut test to be updated where the generic seam needs an equivalent implementation; the plan names it rather than hiding it (see Complexity Tracking). |
| IV. What is drawn, played or encoded is proved in a browser | A temporary `verify-*.html` harness; the recorder's real share is the user's to run | PASS | `quickstart.md` names the harnesses: the canvas (pick, move, resize, copy, delete, undo), the image (choose, place, draw), the export, and the reload. The recorder's flow is untouched and stated as a gap. |
| V. The words come first | A new concept is written into `GLOSSARY.md` before it appears in code | PASS | Step 1 is a docs-only change; the glossary and the skills are updated before any code moves. |
| VI. One change per pull request, and CI owns the version | A plan's step gets its own branch and pull request; `package.json` is never bumped by hand | PASS | The plan is a sequence of seven steps, each its own branch and pull request. No step edits `package.json`. |

No violations. The Complexity Tracking table carries one deliberate departure, not a
violation: the SC-003 relaxation.

## Project Structure

### Documentation (this feature)

```text
specs/003-annotation-plugins/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities and value objects
├── quickstart.md        # Phase 1 verification guide
├── contracts/
│   ├── annotation-plugin.md   # the seam: base class, plugin, canvas
│   └── image-annotation.md    # the image kind, its store and its persistence
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── spec.md              # Feature specification
```

### Source Code (target layout)

```text
src/
├── domain/
│   └── annotation/
│       ├── Annotation.ts          # base class; `withHandle` gains an optional options arg
│       ├── AnnotationSet.ts       # unchanged
│       ├── Arrow.ts               # unchanged in behaviour; a kind under the seam
│       ├── ImageAnnotation.ts     # NEW — the image kind, pure geometry
│       └── kinds.ts               # the register; registers Arrow and ImageAnnotation
├── application/
│   ├── keep-clip.ts               # unchanged; images are written by their own store
│   ├── restore-clip.ts            # unchanged
│   └── ports/
│       └── ImageStorePort.ts      # NEW — put a picture, read them all back
├── infra/
│   ├── clip-store.ts              # DB version 3; a third store `images`; clear() clears it
│   └── images.ts                  # NEW — the image store (IndexedDB) and the decoded cache
├── ui/
│   ├── annotating/
│   │   ├── annotation-plugin.ts   # NEW — AnnotationPlugin, AnnotationAction, CreationContext, the registry
│   │   ├── arrow-plugin.ts        # NEW — the arrow's renderer and its creation, moved from annotation-layer/edit
│   │   ├── image-plugin.ts        # NEW — the image's renderer and its creation (picker, paste, drop)
│   │   ├── annotation-layer.ts    # the shared drawing: drawAnnotations, the grips, the controls
│   │   ├── annotation-canvas.ts   # NEW — the shared canvas, from annotation-edit.ts; kind-agnostic
│   │   ├── annotation-clipboard.ts# unchanged
│   │   └── annotation-lane.ts     # unchanged except the mark's symbol per kind
│   ├── cutting/
│   │   └── marks.ts               # the section's actions built from the plugins
│   ├── exporting/
│   │   ├── export-flow.ts         # awaits the images before encoding
│   │   └── frame-renderer.ts      # unchanged; draws through the one layer
│   └── lifecycle/
│       └── view-lifetime.ts       # clears the image cache with the session
├── state.ts, session.ts, main.ts  # main.ts wires the two plugins
├── index.html                     # the help text gains the image
└── FEATURES.md, GLOSSARY.md       # the words and the feature list
```

**Structure Decision**: Keep the existing four layers and the existing names. The
seam is a **view** concept — a plugin is how a kind is drawn and made, and that is the
view's business — so it lives in `ui/annotating/`, under the same id as the domain
class, exactly as the renderer does today. The domain keeps only the shape rules: a
kind stays a subclass of `Annotation` in `domain/annotation/`. One new port
(`ImageStorePort`) sits in `application/ports/`; its adapter and the decoded cache sit
in `infra/`. `annotation-edit.ts` becomes `annotation-canvas.ts` and stops naming the
arrow; `annotation-layer.ts` keeps only the drawing every kind shares.

## Implementation Sequence

Each step is its own branch and pull request. A step leaves the app working and its
tests green. The order extracts the seam from the arrow first (so the regression is
provable while only one kind exists), then adds the image kind, then its bytes, then
its plugin in the view, and the docs last.

| Step | Change | Proof | Pull request |
|---|---|---|---|
| 1 | **Words and map.** Add **annotation plugin**, **annotation canvas**, **image annotation** and **image store** to `GLOSSARY.md`; update the Overview and Domain model skills' module maps. No code. | Docs review; the glossary is the only source of the words. | `docs/annotation-plugin-words` |
| 2 | **The plugin seam.** Add `AnnotationPlugin`, `AnnotationAction`, `CreationContext` and the registry in `ui/annotating/annotation-plugin.ts`; move the arrow's renderer and its `arrowMetrics` into `arrow-plugin.ts`; rename `annotation-edit.ts` to `annotation-canvas.ts` and make it ask the plugin instead of naming `Arrow`. Only the arrow is registered. No behaviour change. | The `Arrow`, `AnnotationSet` and `Clip` unit tests unmodified; `annotation-layer.test.ts` with its imports pointed at `arrow-plugin.ts` and its assertions unchanged (the stated departure); a browser harness that the arrow still draws, picks, moves, aims, copies, deletes and undoes, and that the section action is unchanged. | `refactor/annotation-plugin-seam` |
| 3 | **Creation as a plugin.** The section's action row is built from the registered plugins; the arrow's creation (arm, drag, draft, commit, the stray-click message) moves into `arrow-plugin.ts` behind `CreationContext`. Still only the arrow. No behaviour change. | The unit tests; the same harness as step 2, plus the armed message and the stray-click refusal. | `refactor/annotation-creation-plugin` |
| 4 | **The image kind (domain).** Add `ImageAnnotation` — its rect, its two ratios, its four corner handles, keep-proportions resize (free with the options flag), `movedBy`, `hitTest`, `stored`/`restore` — with unit tests; register it in `kinds.ts`; widen `Annotation.withHandle` with the optional options argument. No view yet, so nothing creates one. | Unit tests for every rule beside the file; the `Arrow` tests unmodified (the extra argument is optional). | `feat/image-annotation-kind` |
| 5 | **Where a picture is kept.** Add `ImageStorePort` and `infra/images.ts` (the `images` store, DB version 3, and the decoded cache); `clip-store.ts`'s `clear()` clears it; the resume flow loads the pictures into the cache after a restore. Nothing creates an image yet. | Unit tests for keep/restore with a fake store carrying images; a browser harness that a picture put in the store comes back decoded after a reload. | `feat/image-store` |
| 6 | **The image plugin (view).** Add `image-plugin.ts`: choose a picture (file picker, paste, drag-and-drop onto the picture), measure it, place it centred at a default size, draw it through the one layer, and let the shared canvas move, copy, delete and undo it; wire it in `main.ts`; the export awaits the decoded pictures. | A browser harness: place an image, see it in playback and in `exportOffline`'s canvas, reload and see it back; the shared operations exercised on it; the recorder untouched. | `feat/image-annotation-plugin` |
| 7 | **Docs and final verification.** The help modal and `FEATURES.md` gain the image and the shared editing; the README module map is updated; the full suite and the end-to-end harness run; a real session is run by the user. | The three levels of the Verification skill; the unit tests; the harnesses pasted into the pull request; the arrow's tests unmodified or the change named. | `docs/annotation-plugin-final` |

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Departure | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| An existing arrow or cut test may be updated where the generic seam needs an equivalent implementation (spec SC-003, relaxed by the user) | The seam is extracted from the arrow, and `annotation-layer.test.ts` asserts the arrow's *own* renderer and its `arrowMetrics` through the shared layer; when those move into `arrow-plugin.ts`, the test's **imports** move with them even though every assertion is unchanged. The `Arrow` and `Clip` tests need nothing. | Keeping every test byte-identical would either forbid the extraction the feature is, or push the difference into a new test that no longer proves the arrow — the departure is stated in the pull request, the assertions are kept, and the arrow's behaviour is still asserted |

No constitution violations. No new layer, no new dependency, and no change to
recording, cutting or publishing.

## Post-Design Constitution Check

Re-checked after the Phase 1 design artifacts were written.

| Principle | Result | Evidence |
|---|---|---|
| I. The skills are the constitution | PASS | The plan follows the Domain model skill (rules in the class, drawing in the view, one id) and the Verification skill (unit test vs harness). Step 1 updates the glossary and the skills first. |
| II. `src/domain/` is pure | PASS | `data-model.md` keeps `ImageAnnotation` to numbers and an id; the bytes and their decoding are in `infra/images.ts`; `contracts/annotation-plugin.md` states the dependency rule and that the domain imports neither the view nor the browser. |
| III. Every rule has a test beside it | PASS, with the stated departure | `data-model.md` names the `ImageAnnotation` tests; `quickstart.md` runs them; the arrow and clip tests are the regression proof; the departure is recorded above. |
| IV. What is drawn, played or encoded is proved in a browser | PASS | `quickstart.md` names the harness for the canvas, the image, the export and the reload; the real share is stated as a gap. |
| V. The words come first | PASS | Step 1 is a docs-only change; the glossary and the skills are updated before any code moves. |
| VI. One change per pull request, and CI owns the version | PASS | The plan has seven steps, each its own branch and pull request; no step edits `package.json`. |

No new violations. The design is ready for `/speckit.tasks`.
