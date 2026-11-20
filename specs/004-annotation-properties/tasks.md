---

description: "Task list for Annotation Properties"
---

# Tasks: Annotation Properties

**Input**: Design documents from `/specs/004-annotation-properties/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — the project's constitution makes them part of done. A rule in `src/domain/` is proved by a **unit test in node** beside it (Principle III); anything drawn or edited is proved by a temporary **browser harness** on the dev server (Principle IV); the reload with real IndexedDB is the user's to run. A harness file is deleted before its commit and its output pasted into the pull request.

**Organization**: Tasks are grouped by user story. **Each phase is one or more pull requests** (Principle VI); the branch name is in each phase heading. The plan's six steps map like this:

| Plan step | Phase |
|---|---|
| 1 Words | Phase 1 |
| 2 A colour with the annotation | Phase 2 |
| 3 The property seam | Phase 2 |
| 4 The inspector, for colour | Phase 3 (US1) |
| 5 The words, and the entry | Phase 4 (US2) |
| 6 Docs and final verification | Phase 6 |

US3 has no plan step of its own: the promise is what Phases 2–5 *prove*, and Phase 5 records the proof.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are in each description
- Field constraints are cited as `data-model.md <Entity.field>`, the canonical source

## Path Conventions

Single project (browser SPA), per plan.md: `src/` at the repository root. Domain in `src/domain/`, the DOM in `src/ui/`, composition in `src/main.ts`; `index.html` and `styles.css` at the root. Unit tests sit beside the file they prove (`*.test.ts`). Harnesses are `verify-*.html` at the repository root and are never committed.

---

## Phase 1: Setup — the words (branch `docs/annotation-properties-words`)

**Purpose**: The words come first (constitution V, plan step 1). No code.

- [x] T001 Add the four words to the Annotating section of `GLOSSARY.md` — **annotation property** (something about an annotation the user can change after it is placed, declared by its kind), **properties inspector** (the one shared surface that shows and edits the picked annotation's properties), **colour** (one flat colour from the app's palette that an annotation is drawn in), **text entry** (the app's own dialog for typing a line, used for entering and editing a text) — with their code pointers.
- [x] T002 [P] Update the module map in `.agents/skills/domain-model/SKILL.md`: `AnnotationColour` in `domain/annotation/`, and `properties-inspector.ts` and `text-entry.ts` in `ui/annotating/`.

**Checkpoint**: The glossary and the skill name the feature; nothing in `src/` has changed.

---

## Phase 2: Foundational (Blocking Prerequisites) — branches `feat/annotation-colour`, `feat/annotation-property-seam`

**Purpose**: The colour rule, the value on each kind that draws with one, and the property seam. **No user story can be told until this is complete.**

**⚠️ CRITICAL**: US1 and US2 both build on the descriptor and on a value that lives with the annotation.

- [x] T003 Create `src/domain/annotation/AnnotationColour.ts` and its test `src/domain/annotation/AnnotationColour.test.ts`: the palette and the reader (`data-model.md AnnotationColour.COLOURS`, `AnnotationColour.colourOf`). The test covers every palette entry, and the fallback for `undefined`, `''`, an unknown colour and a non-string.
- [x] T004 [P] Add the colour to the arrow in `src/domain/annotation/Arrow.ts` with a test beside it: `Arrow.colour` (`data-model.md Arrow.colour`), `create(..., colour?)` defaulting to the arrow's red, `withColour`, the colour carried by `withHandle`/`movedBy`/`withSpan`/`duplicated`, and `stored`/`restore` tolerant of an older clip with no colour (`data-model.md` "the stored shape").
- [x] T005 [P] Add the colour to the text in `src/domain/annotation/TextAnnotation.ts` with a test beside it: `TextAnnotation.colour` (`data-model.md TextAnnotation.colour`), defaulting to white, `withColour`, the colour carried everywhere, and a tolerant restore.
- [x] T006 Make both renderers draw with the value: `src/ui/annotating/arrow-plugin.ts` (shaft and head) and `src/ui/annotating/text-plugin.ts` (the fill), keeping the arrow's dark edge and the text's dark outline.
- [x] T007 Add the seam to `src/ui/annotating/annotation-plugin.ts`: `PropertyControl`, `AnnotationProperty` (`data-model.md AnnotationProperty.value`, `AnnotationProperty.with`), `properties?` on `AnnotationPlugin` (`data-model.md AnnotationPlugin.properties`), and one `propertiesOf(annotation)` helper the layer, the canvas and the inspector all ask.
- [x] T008 Declare the colour property on `src/ui/annotating/arrow-plugin.ts` and `src/ui/annotating/text-plugin.ts` — the arrow's red and the text's white as their defaults.
- [x] T009 [P] Extend `src/ui/annotating/annotation-plugin.test.ts` — **DOM-free**: the arrow's property list, `propertiesOf` for an arrow and for none, and a stub kind with properties and one without (`data-model.md` "The properties the kinds declare"). The image's and the text's lists are proved in the harness (T028), because their modules touch the DOM at load.

**Checkpoint**: A colour lives with the annotation, a kind declares it, and the renderers honour it. Nothing in the UI can change it yet.

---

## Phase 3: User Story 1 — Change how an annotation looks after it is placed (Priority: P1) 🎯 MVP

**Goal**: The settings control, the popover and the swatches (plan step 4). After this phase a person can recolour a placed arrow and see it everywhere.

**Branch**: `feat/properties-inspector`.

**Independent Test**: Place an arrow, pick it, press its settings control, choose another colour, play the clip and export it — the arrow is the new colour in both — then undo once.

### Implementation for User Story 1

- [x] T010 [P] [US1] Add the popover's element and styling: `index.html` (a body-level `#prop-menu`), `src/ui/dom.ts` (its entry), and `styles.css` (the panel and the swatches), following the camera menu's look.
- [x] T011 [P] [US1] Draw the settings control in `src/ui/annotating/annotation-layer.ts` from the same `controlSpot` geometry as the × and the copy, and only when `propertiesOf(picked)` is non-empty.
- [x] T012 [US1] Add `src/ui/annotating/properties-inspector.ts`: the class with `open`/`close`/`toggle`, placed in viewport coordinates from the annotation's box and clamped (`ui/recording/camera-menu.ts` is the pattern), with outside-click, Escape and resize closing it, and the clip and the selection watched.
- [x] T013 [US1] Render the popover's controls in `src/ui/annotating/properties-inspector.ts` from the descriptors: a label, and for a `colour` property the palette as swatches from `COLOURS` (`data-model.md AnnotationColour.COLOURS`) with the current one marked; apply through `clip.changeAnnotation`.
- [x] T014 [US1] Hit-test the settings control in `src/ui/annotating/annotation-canvas.ts` before the grips and before the picture, and have it call `inspector.toggle()`.
- [x] T015 [US1] Wire the inspector in `src/main.ts`.

### Verification for User Story 1

- [x] T016 [P] [US1] Browser harness `verify-properties.html` (deleted before commit): the settings control appears on a picked arrow and **not** on a picked image; pressing it opens the popover; pressing it again, Escape, an outside click and a resize close it.
- [x] T017 [US1] Browser harness `verify-properties.html`: a swatch recolours the arrow at once and the popover stays open; the new colour is drawn in playback and on `exportOffline`'s canvas; one undo puts the previous colour back.
- [x] T018 [US1] Record the regression proof: `npx vitest run` over `src/domain/annotation/` and `src/domain/clip/` is green with the existing `Arrow`, `ImageAnnotation`, `TextAnnotation`, `AnnotationSet`, `Clip` and `ExportPlan` tests **unmodified**; if one had to change, name it and say why.

**Checkpoint**: US1 is shippable — a placed annotation can be re-specified in colour.

---

## Phase 4: User Story 2 — Change the words of a text after it is placed (Priority: P2)

**Goal**: The text's words property and the one in-app entry (plan step 5), replacing the browser prompt.

**Branch**: `feat/text-entry-property`.

**Independent Test**: Place a text, open its settings, change the words, and see the new words in the picture, playback and the export, in the same place; undo once to get the old words back; and no browser prompt appears.

### Tests for User Story 2

- [x] T019 [US2] Add the tests for `withWords` in `src/domain/annotation/TextAnnotation.test.ts`: the size and the anchor kept when the words fit; one factor shrinks both when they would run past the picture and the anchor does not move; colour, span and id kept; empty words refused. The width is handed in, never measured (`data-model.md TextAnnotation.withWords`).

### Implementation for User Story 2

- [x] T020 [US2] Add `withWords(words, measuredWidth)` to `src/domain/annotation/TextAnnotation.ts` (`data-model.md TextAnnotation.withWords`).
- [x] T021 [US2] Add the `words` descriptor to `src/ui/annotating/text-plugin.ts` — it measures the new words at the annotation's current height with the same font the renderer draws, hands the width to `withWords`, and refuses empty words.
- [x] T022 [US2] Add `src/ui/annotating/text-entry.ts`: the one in-app entry, `ask(initial): Promise<string | null>`, an input with Cancel and Add, Enter to confirm, Escape to cancel, the input focused.
- [x] T023 [P] [US2] Add the entry's element and styling: `index.html`, `src/ui/dom.ts` and `styles.css`, in the app's dialog style.
- [x] T024 [US2] Make the text kind's creation use the entry in `src/ui/annotating/text-plugin.ts`, and remove `window.prompt` (spec FR-013).
- [x] T025 [US2] Render the `text` control in `src/ui/annotating/properties-inspector.ts`: a row with the current words and an action that opens the entry; apply on confirm, leave the annotation unchanged on cancel, and tell the user why an empty entry is refused.

### Verification for User Story 2

- [x] T026 [US2] Browser harness `verify-properties.html`: creating a text opens the in-app entry and never the prompt; the inspector edits the words; the box follows; words too long shrink the font without moving the top-left; an empty entry is refused; a cancelled entry changes nothing; one undo reverts the whole edit.

**Checkpoint**: Both P1 and P2 work; the prompt is gone.

---

## Phase 5: User Story 3 — The next property, and the next kind, fit the inspector (Priority: P3)

**Goal**: Prove the promise (plan step 6): a property or a kind is added by describing it, and the inspector is untouched.

**Branch**: folded into `feat/properties-inspector` and `feat/text-entry-property`.

**Independent Test**: Register a stub kind with a property and confirm the inspector shows its control with no change to the inspector; and that adding the text's words property touched only the text kind.

### Verification for User Story 3

- [x] T027 [P] [US3] Extend `src/ui/annotating/annotation-plugin.test.ts` with a stub kind declaring a property: `propertiesOf` returns it, and a stub with none returns an empty list — the inspector's input is the descriptor alone (contract §1, §4).
- [x] T028 [P] [US3] Browser harness `verify-properties.html`: register a stub plugin with a `colour` property in the page and confirm its settings control and its swatch row appear without touching the inspector.
- [x] T029 [US3] Record that the `words` property touched only `src/domain/annotation/TextAnnotation.ts` and `src/ui/annotating/text-plugin.ts` (name the files in the pull request) and that the full suite's outcome is unchanged from T018 (`specs/004-annotation-properties/tasks.md`).

**Checkpoint**: The promise holds — a property is a descriptor on its kind, and the inspector asks.

---

## Phase 6: Polish & Cross-Cutting Concerns (branch `docs/annotation-properties-final`)

- [x] T030 [P] Update the help modal in `index.html`: a picked annotation's settings control, the colour swatches, and the text entry replacing the prompt.
- [x] T031 [P] Update `FEATURES.md`'s annotations entry: colour and words can be changed after placing.
- [x] T032 [P] Update the module map in `README.md`: `AnnotationColour.ts`, `properties-inspector.ts`, `text-entry.ts`.
- [x] T033 Run the full gate from `package.json`: `npm run lint && npm run typecheck && npx vitest run && npm run build`.
- [x] T034 Run `quickstart.md` end to end and paste its output into the pull request, stating which Verification level each part got and what was not verified.
- [x] T035 [P] Delete any `verify-*.html` harness left in the repository root and confirm none is committed.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies; MUST land first (constitution V).
- **Foundational (Phase 2)**: depends on Phase 1; **blocks** Phases 3–5.
- **US1 (Phase 3)**: depends on Phase 2. No dependency on US2 or US3.
- **US2 (Phase 4)**: depends on Phase 2 **and on US1's inspector** — the words are edited from it. Independently testable once US1 lands.
- **US3 (Phase 5)**: mostly a *verification* of Phases 2–4; its tests can land with US1 and US2.
- **Polish (Phase 6)**: depends on all desired stories.

### User Story Dependencies

- **US1 (P1)**: independent after Foundational. The MVP — colour on a placed annotation.
- **US2 (P2)**: needs US1's inspector (the surface) and the text kind's colour (Foundational). It does not touch the arrow's or the image's code.
- **US3 (P3)**: needs US1 and US2 to exist (the words are the second property that proves it).

### Within Each User Story

- A rule's test is written with the rule (T003, T004, T005, T019).
- The domain before the view; the descriptor before the control that renders it.
- The inspector before the canvas opens it (T012–T013 before T014).

### Parallel Opportunities

- Phase 1: T001 and T002 (glossary vs skill).
- Phase 2: T004 and T005 (arrow vs text); T009 after T008.
- Phase 3: T010 and T011 (the element/CSS vs the layer) are different files; T016 can be written once T012–T014 compile.
- Phase 4: T019 (the test) can be written before T020; T023 is independent of T021/T022.
- Phase 5: T027 and T028 (a node test vs the harness).
- Phase 6: T030, T031 and T032 (three docs files).

---

## Parallel Example: Phase 3 (US1)

```bash
# Different files, no dependency between them:
Task: "Add #prop-menu and its CSS (index.html, ui/dom.ts, styles.css) — T010"
Task: "Draw the settings control in annotation-layer.ts — T011"
```

## Parallel Example: Phase 4 (US2)

```bash
# The rule's test can be written first, and the entry's markup is independent:
Task: "Add withWords tests in TextAnnotation.test.ts — T019"
Task: "Add the entry element and CSS (index.html, ui/dom.ts, styles.css) — T023"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 (the words) → Phase 2 (colour + seam) → Phase 3 (the inspector, colour).
2. **STOP and VALIDATE**: a picked arrow can be recoloured, seen in playback and the export, undone, and the image has no settings control.
3. This is shippable and delivers the thing the feature is.

### Incremental Delivery

1. Phases 1–3 → the inspector and colour (MVP).
2. Phase 4 → the words, and the prompt gone.
3. Phase 5 → the promise recorded with a stub kind's test.
4. Phase 6 → the docs and the full verification.

Each phase is its own pull request; the user merges, and CI owns the version.

---

## Notes

- [P] tasks are different files with no dependency between them.
- [Story] labels map each task to its spec story; Setup, Foundational and Polish tasks carry none.
- A harness (`verify-*.html`) is never committed; its output goes in the pull request.
- The existing kinds' tests are the regression proof and must pass **unmodified** — the colour is optional at each factory and defaults to the kind's own, so their `toMatchObject` assertions still hold.
- The checkbox that other sessions use: this checkout may carry another change in progress; check `git status` before branching and keep each step's diff to its own files.