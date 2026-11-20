# Implementation Plan: Annotation Properties

**Branch**: `feat/annotation-properties` | **Date**: 2026-11-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-annotation-properties/spec.md`

## Summary

An annotation can be placed, moved and resized but never re-specified. This adds the
other half of the feature: a kind **declares the properties it offers** — its colour, a
text's words — and one shared **properties inspector** shows and edits the picked
annotation's, whatever its kind. A change is an ordinary change to the clip, so it is
announced, undone by the one undo, and kept with the clip without a second path being
written.

The inspector is a popover opened from a **settings control** on the picked annotation,
beside the × and copy controls it already has, and it is placed the way the camera menu
is. Colour is one flat colour from a fixed palette; a re-worded text keeps the font size
the user set and only shrinks when the words would not otherwise fit, and the browser
`prompt` the text kind was added with is replaced by an in-app text entry used for both
entering and editing.

## Technical Context

**Language/Version**: TypeScript ^6.0.3, ES modules, strict.

**Primary Dependencies**: Vite ^8.3.8 (dev server and build), Vitest ^5.1.0 (node tests), Mediabunny ^1.66.0 (offline export), `@atproto/oauth-client-browser` ^0.5.14 (Bluesky sign-in). **No new runtime dependency**: the popover is DOM and CSS, the palette is a constant, and measuring a text is `CanvasRenderingContext2D.measureText`, already used by the text kind.

**Storage**: unchanged. A property value lives with the annotation and is written down in its geometry, so the clip store's small half carries it with everything else; the recording is never touched and the pictures are kept where they are today.

**Testing**: Vitest in node for the colour rule, `TextAnnotation.withWords`, the kinds' `withColour`, and the stored round-trip; a temporary `verify-*.html` harness on the dev server for the settings control, the popover, the swatches, the text entry, playback and the export; a real reload with real IndexedDB for the user. The existing `Arrow`, `ImageAnnotation`, `TextAnnotation`, `Clip`, `AnnotationSet` and `ExportPlan` tests are the regression proof and must pass unmodified.

**Target Platform**: Modern browsers. The popover is placed in viewport coordinates and clamped, as the camera menu already is (`ui/recording/camera-menu.ts`); the text entry is a body-level dialog like the app's other menus.

**Project Type**: Single-project browser application (SPA), no backend.

**Performance Goals**: no measurable change. A property change is a `changeAnnotation`, which re-renders one frame; the popover is built from a handful of DOM nodes and does not run while closed.

**Constraints**: no new runtime dependency. The existing kinds' tests must pass **unmodified** — the geometry gains a colour the factory takes **optionally**, with the kind's default, so `stored()` gains a field and `toMatchObject` still holds. One step per pull request. CI owns the version; `package.json` is not bumped by hand. The words go into `GLOSSARY.md` before they appear in code. `src/domain/` stays pure — measuring a text and drawing the controls are the view's.

**Scale/Scope**: three kinds today; two of them offer properties in this version (arrow: colour; text: colour and words) and the image offers none. The change touches the domain's annotation family, the two plugins, the layer and the canvas (a third control), and adds two view modules (the inspector and the text entry) plus their markup and CSS.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status | Evidence |
|---|---|---|---|
| I. The skills are the constitution | The plan must not disagree with `.agents/skills/` or `GLOSSARY.md`; new words go in the glossary first | PASS | Step 1 adds **annotation property**, **properties inspector**, **colour** and **text entry** to `GLOSSARY.md` and updates the Domain model skill's module map before any code moves. |
| II. `src/domain/` is pure | No DOM, no browser API, no import from `ui/` or `infra/`; a collaborator is a port | PASS | `AnnotationColour` and the kinds' `withColour` / `TextAnnotation.withWords` are pure: the words' width is **handed in** as a number, measured in the view. The popover, the swatches and the text entry are `ui/`. |
| III. Every rule has a test beside it | A rule in `domain/` is proved by a unit test in node; a refactor's proof is the old tests passing unmodified | PASS | Tests for the colour rule, `withColour` on both kinds, `withWords` (size kept, shrink to fit, anchor held) and the stored round-trip. The existing kind tests pass unmodified — the factory takes the colour optionally, with the kind's default, so `toMatchObject` still holds. |
| IV. What is drawn, played or encoded is proved in a browser | A temporary `verify-*.html` harness; the recorder's real share is the user's to run | PASS | `quickstart.md` names the harness for the settings control, the popover, the swatches, the text entry, the change in playback and export, and undo; the recorder is untouched and stated as a gap. |
| V. The words come first | A new concept is written into `GLOSSARY.md` before it appears in code | PASS | Step 1 is a docs-only change. |
| VI. One change per pull request, and CI owns the version | A plan's step gets its own branch and pull request; `package.json` is never bumped by hand | PASS | Six steps, each its own branch and pull request. No step edits `package.json`. |

No violations. The Complexity Tracking table stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/004-annotation-properties/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities and value objects
├── quickstart.md        # Phase 1 verification guide
├── contracts/
│   └── annotation-property.md   # The descriptor contract and the colour rule
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── spec.md              # Feature specification
```

### Source Code (target layout)

```text
src/
├── domain/
│   └── annotation/
│       ├── AnnotationColour.ts   # NEW — the palette and how a colour is read back
│       ├── Arrow.ts              # the geometry gains a colour; withColour
│       ├── TextAnnotation.ts     # the geometry gains a colour; withColour; withWords
│       ├── ImageAnnotation.ts    # unchanged — the image offers no properties
│       └── kinds.ts              # unchanged
├── ui/
│   ├── annotating/
│   │   ├── annotation-plugin.ts  # NEW: AnnotationProperty, and `properties` on the plugin
│   │   ├── arrow-plugin.ts       # declares a colour property; draws with it
│   │   ├── text-plugin.ts        # declares a colour and a words property; entry replaces prompt
│   │   ├── image-plugin.ts       # declares none
│   │   ├── annotation-layer.ts   # draws a third control: the settings gear
│   │   ├── annotation-canvas.ts  # hit-tests the settings control and opens the inspector
│   │   ├── properties-inspector.ts # NEW — the popover: swatches, the words row
│   │   ├── text-entry.ts         # NEW — the one in-app entry for entering and editing
│   │   └── plugins.ts            # unchanged
│   └── ...
├── dom.ts                        # the popover element
├── index.html                    # the popover's element
├── styles.css                    # the popover and its swatches
└── FEATURES.md, README.md, GLOSSARY.md
```

**Structure Decision**: the value lives with the annotation (`domain/annotation/`), the
descriptor and the controls live in the view under the kind's plugin (`ui/annotating/`),
and the inspector is one view module that names no kind. The settings control is drawn
and hit-tested where the × and copy controls already are, so the third control is the
layer's and the canvas's, not a kind's. The popover follows the camera menu's pattern —
a body-level element, placed in viewport coordinates, clamped, with its own listeners.

## Implementation Sequence

Each step is its own branch and pull request. A step leaves the app working and its
tests green.

| Step | Change | Proof | Pull request |
|---|---|---|---|
| 1 | **Words.** Add **annotation property**, **properties inspector**, **colour** and **text entry** to `GLOSSARY.md`; update the Domain model skill's module map. No code. | Docs review. | `docs/annotation-properties-words` |
| 2 | **A colour with the annotation.** Add `AnnotationColour` — the palette, `colourOf`, the per-kind default; give `ArrowGeometry` and `TextGeometry` a colour the factory takes optionally, with the kind's default; add `withColour` to both; make both renderers draw with it. | Unit tests for the colour rule, `withColour` and the stored round-trip; the existing kind tests unmodified; a harness that an arrow and a text drawn with a chosen colour paint it. | `feat/annotation-colour` |
| 3 | **The property seam.** Add `AnnotationProperty` and `properties` to `AnnotationPlugin`; the arrow declares colour, the text declares colour and words, the image declares none. The words' rule is `TextAnnotation.withWords(words, measuredWidth)` — the size kept, shrunk only to fit, the anchor held — with a test, the measuring left to the view. | Unit tests for `withWords`; a registry test that the properties are what each kind declares and the image has none. | `feat/annotation-property-seam` |
| 4 | **The inspector, for colour.** A third control on the picked annotation (the settings gear, drawn by the layer, hit by the canvas); a body-level popover placed like the camera menu; swatches from the palette; a change goes through `clip.changeAnnotation`. The settings control appears only for a kind that has properties. | A harness: the control appears for the arrow and not the image, opens the popover, a swatch recolours the arrow in the picture, playback and the export, and one undo reverts it. | `feat/properties-inspector` |
| 5 | **The words, and the entry.** A shared in-app `text-entry`; the text plugin's creation uses it instead of `prompt`; the inspector's words row opens it; confirming applies the edit through `withWords`. | A harness: creating a text no longer prompts; the inspector edits the words; the box follows and stays inside; one undo reverts; a cancelled entry changes nothing. | `feat/text-entry-property` |
| 6 | **Docs and final verification.** The help modal, `FEATURES.md` and the README say what can be changed; the full suite and the harnesses; a real reload by the user. | The three levels of the Verification skill; the existing tests unmodified. | `docs/annotation-properties-final` |

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. The change adds no layer, no dependency and no change to recording,
cutting or publishing. It adds two view modules and one domain value object, and grows
the kind contract by one optional field.

## Post-Design Constitution Check

Re-checked after the Phase 1 design artifacts were written.

| Principle | Result | Evidence |
|---|---|---|
| I. The skills are the constitution | PASS | The plan follows the Domain model skill (rules in the class, drawing in the view, one id) and the Verification skill. Step 1 updates the glossary and the skill first. |
| II. `src/domain/` is pure | PASS | `contracts/annotation-property.md` keeps the descriptor in the view and the value in the domain; `data-model.md` gives `withWords` the measured width as a number. |
| III. Every rule has a test beside it | PASS | `data-model.md` names the tests for the colour rule, `withColour` and `withWords`; `quickstart.md` runs them; the existing kind tests are the regression proof. |
| IV. What is drawn, played or encoded is proved in a browser | PASS | `quickstart.md` names the harness for the control, the popover, the swatches, the entry, playback and the export; the real reload is stated as the user's. |
| V. The words come first | PASS | Step 1 is docs-only. |
| VI. One change per pull request, and CI owns the version | PASS | Six steps, each its own branch and pull request; no step edits `package.json`. |

No new violations. The design is ready for `/speckit.tasks`.