---

description: "Task list for Annotation Plugins"
---

# Tasks: Annotation Plugins

**Input**: Design documents from `/specs/003-annotation-plugins/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — the project's constitution makes them part of the definition of done. A rule in `src/domain/` is proved by a **unit test in node** beside it (Principle III); anything drawn, played or encoded is proved by a temporary **browser harness** on the dev server (Principle IV); the recorder's real screen share is the user's to run (stated as a gap). A harness file is deleted before its commit and its output pasted into the pull request.

**Organization**: Tasks are grouped by user story. **Each phase is one or more pull requests** (Principle VI, one change per pull request); the branch name is named in each phase heading. The plan's seven steps map to the phases like this:

| Plan step | Phase |
|---|---|
| 1 Words and map | Phase 1 |
| 2 The plugin seam (types) | Phase 2 |
| 2–3 The seam and creation (arrow only) | Phase 3 (US1) |
| 4 The image kind (domain) | Phase 4 (US2) |
| 5 Where a picture is kept | Phase 4 (US2) |
| 6 The image plugin (view) | Phase 4 (US2) |
| 6–7 The promise and the docs | Phase 5 (US3), Phase 6 |

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are in each description
- Field constraints are cited as `data-model.md <Entity.field>`, the canonical source

## Path Conventions

Single project (browser SPA), per plan.md: `src/` at the repository root. Domain in `src/domain/`, use cases and ports in `src/application/`, browser adapters in `src/infra/`, the DOM in `src/ui/`, composition in `src/main.ts`. Unit tests sit beside the file they prove (`*.test.ts`). Harnesses are `verify-*.html` at the repository root and are never committed.

---

## Phase 1: Setup — the words (branch `docs/annotation-plugin-words`)

**Purpose**: The words come first (constitution V, plan step 1). No code in this phase.

- [ ] T001 Add the four words to the Annotating section of `GLOSSARY.md` — **annotation plugin** (a kind's action, renderer and creation, in the view under the kind's id), **annotation canvas** (the one shared editing surface), **image annotation** (the new kind), **image store** (where a picture is kept, apart from the recording) — with their code pointers.
- [ ] T002 [P] Update the module maps in `.agents/skills/overview/SKILL.md` and `.agents/skills/domain-model/SKILL.md` to name the plugin seam and the image kind, so the skills and the glossary agree before any code moves.

**Checkpoint**: The glossary and the skills name the feature; nothing in `src/` has changed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared vocabulary every kind and the canvas are written against. This is the first half of plan step 2. **No user story can begin until this is complete.**

**⚠️ CRITICAL**: Both US1 and US2 depend on these two types.

- [ ] T003 [P] Widen `Annotation.withHandle` in `src/domain/annotation/Annotation.ts` with the optional `options` argument and add the `HandleOptions` type (`data-model.md HandleOptions.free`). The argument MUST be optional so `src/domain/annotation/Arrow.ts` and every existing call site compile and behave unchanged (`contracts/annotation-plugin.md` §1, spec SC-003).
- [ ] T004 [P] Add the seam's types and registry in `src/ui/annotating/annotation-plugin.ts`: `AnnotationRenderer` (moved from `annotation-layer.ts`), `AnnotationPlugin`, `AnnotationAction`, `CreationContext`, and `registerPlugin` / `pluginOf` / `plugins` (`data-model.md AnnotationPlugin.*`, `CreationContext.*`, `AnnotationAction.*`; `contracts/annotation-plugin.md` §2). The registry is keyed by the kind's id.

**Checkpoint**: The base class and the registry exist; the arrow is not yet registered, so nothing behaves differently.

---

## Phase 3: User Story 1 — Every annotation is edited the same way (Priority: P1) 🎯 MVP

**Goal**: The arrow's private gesture becomes the **shared canvas** and the arrow becomes the first **plugin** (plan steps 2–3). After this phase, the shared operations — pick, move, resize, copy, paste, delete, undo — belong to the canvas and name no kind, and the section offers the kind's action from the register.

**Branches**: `refactor/annotation-plugin-seam`, then `refactor/annotation-creation-plugin` (two pull requests).

**Independent Test**: With a clip made by hand, an arrow still draws, picks, moves, aims, copies, pastes, deletes and undoes exactly as before, and the section's **Arrow** action arms and draws it. (The spec's scenario 1 — the same gestures on a second kind — is completed in Phase 4, when the image kind exists; see Dependencies.)

### Tests for User Story 1

- [ ] T005 [P] [US1] Add `src/ui/annotating/annotation-plugin.test.ts`: registering a plugin, `pluginOf` by id, `plugins()` order, and that an unregistered id answers null.
- [ ] T006 [P] [US1] Update `src/ui/annotating/annotation-layer.test.ts` so its imports of the arrow's renderer and `arrowMetrics` point at `arrow-plugin.ts`; its assertions MUST stay exactly as they are. This is the stated SC-003 departure — name it in the pull request (plan Complexity Tracking).

### Implementation for User Story 1

- [ ] T007 [P] [US1] Create `src/ui/annotating/arrow-plugin.ts`: move `arrowRenderer` and `arrowMetrics` out of `annotation-layer.ts` (unchanged), and export `arrowPlugin` with its `action` (label `Arrow`, its title and its inline svg), its `renderer`, and its `begin`.
- [ ] T008 [US1] Reduce `src/ui/annotating/annotation-layer.ts` to the drawing every kind shares — `drawAnnotations`, the grips from `handles()`, `removeControl` / `copyControl` and `drawControl` — and remove the arrow's own drawing and metrics.
- [ ] T009 [US1] Rename `src/ui/annotating/annotation-edit.ts` to `src/ui/annotating/annotation-canvas.ts` and make it kind-agnostic: it MUST import no kind class, and every operation MUST go through `annotation.hitTest`, `movedBy`, `withHandle`, `duplicated`, and the clip's own add/change/remove/undo (`contracts/annotation-plugin.md` §3, `data-model.md` "the shared canvas").
- [ ] T010 [US1] Implement `add(kindId, span)` on the canvas and the `CreationContext` it hands the plugin — `span`, `picture`, `drag(build, minLength?)`, `draft`, `commit`, `abandon`, `say` (`data-model.md CreationContext.*`). The canvas's pointer plumbing routes a creation drag to the armed plugin's `drag` and draws its `draft` through its `renderer`.
- [ ] T011 [US1] Move the arrow's creation into `arrowPlugin.begin` in `src/ui/annotating/arrow-plugin.ts`: await `drag`, `Arrow.create` from what it returns, `commit`, and `abandon` a stray drag with the message under the timeline (the current `'ARROW — drag across the picture'`).
- [ ] T012 [US1] Pass the free-resize modifier through the canvas: read `Shift` on the pointer move and call `withHandle(end, to, { free })` (`data-model.md HandleOptions.free`; D4 in `research.md`). What it means stays the kind's rule.
- [ ] T013 [P] [US1] Make the canvas's copy and paste toasts name the kind's `action.label` rather than the literal word "Arrow", so a second kind reads correctly (`src/ui/annotating/annotation-canvas.ts`).
- [ ] T014 [US1] Build the section's action row from `plugins()` in `src/ui/cutting/marks.ts`, one button per registered plugin (today just **Arrow**), and route its press to `canvas.add(plugin.id, section)`; keep the "click inside the section to cut" shortcut and the `MIN_SECTION` check.
- [ ] T015 [US1] Update the composition root `src/main.ts`: register the arrow plugin and call `initAnnotationCanvas()` in place of `initAnnotationEdit()`.

### Verification for User Story 1

- [ ] T016 [US1] Browser harness `verify-annotations.html` (deleted before commit): the arrow draws over its stretch in playback and not outside it; a press picks it; dragging its body moves it; dragging an end aims it; the grips and the two controls (copy, remove) are drawn on the picked one; ⌘/Ctrl+C then ⌘/Ctrl+V makes a new arrow at the playhead; Delete and the × remove it; the one undo brings it back; the section's **Arrow** action arms and draws; a stray click is refused with the message.
- [ ] T017 [P] [US1] Browser harness `verify-annotations.html`: with a stub plugin registered in the page, the canvas draws the stub's grips and controls and its action appears in the section's row — the proof the shared operations are not arrow-shaped.
- [ ] T018 [US1] Confirm the regression proof: `npx vitest run src/domain/annotation src/domain/clip` passes with the `Arrow`, `AnnotationSet`, `Clip` and `ExportPlan` tests **unmodified** (only `annotation-layer.test.ts`'s imports changed — T006). Record the outcome for the pull request.

**Checkpoint**: The shared canvas is real and the arrow is its first plugin. US1 is a shippable MVP with the arrow alone; spec scenario 1 completes in Phase 4.

---

## Phase 4: User Story 2 — Put an image over the picture (Priority: P2)

**Goal**: Add the **image** kind end to end: the pure class, where its picture is kept, and the plugin that chooses, places and draws it (plan steps 4–6). The shared editing from Phase 3 applies to it with no change to the arrow.

**Branches**: `feat/image-annotation-kind`, `feat/image-store`, `feat/image-annotation-plugin`.

**Independent Test**: Add an image over a stretch, move it, resize it (proportions by default, free with the modifier), play the clip and export it — it shows in both at the same moment, place and size — then reload and see it back.

**Note**: This phase also completes US1's scenario 1 (a two-kind clip), so it carries the cross-kind tasks T035 and T036.

### Tests for User Story 2

- [ ] T019 [P] [US2] `src/domain/annotation/ImageAnnotation.test.ts` — one test per rule: `create` clamps the rect into `[0, 1]²` and refuses a rect below the minimum; keep-proportions resize solves `height = width · pictureAspect ÷ imageAspect` with the opposite corner fixed (`data-model.md ImageGeometry.imageAspect`, `ImageGeometry.pictureAspect`, `ImageGeometry.width`, `ImageGeometry.height`); free resize takes the height from the drag; a drag past the anchor clamps rather than flipping; `movedBy` pulls the rect inside the picture; `hitTest` inside vs outside; `duplicated` keeps `imageId` under a new id; `stored`/`restore` round-trip and a damaged one reads back as nothing.
- [ ] T020 [P] [US2] `src/application/restore-clip.test.ts` and `src/application/keep-clip.test.ts` — extend with a fake store carrying images, proving a restored clip's pictures come back and a cleared clip lets them go.
- [ ] T021 [P] [US2] `src/infra/images.test.ts` (or a harness if IndexedDB is needed) — a picture put once is read back, and an id with no picture answers null without throwing.

### Implementation for User Story 2

- [ ] T022 [P] [US2] Create the image kind in `src/domain/annotation/ImageAnnotation.ts` (`data-model.md ImageGeometry.*`, `ImageAnnotation.*`; `contracts/image-annotation.md` §1): the four corner handles `nw`/`ne`/`se`/`sw`, keep-proportions by default and free when `options.free`, `movedBy`, `withSpan`, `duplicated` (same `imageId`), `hitTest`, `stored`/`restore`. **No `Blob` and no canvas** — the kind is an id and numbers (constitution II).
- [ ] T023 [US2] Register `ImageAnnotation` beside `Arrow` in `src/domain/annotation/kinds.ts` so `annotationFrom` rebuilds both.
- [ ] T024 [P] [US2] Add the port `src/application/ports/ImageStorePort.ts` (`data-model.md ImageStorePort.*`, `StoredImage.id`, `StoredImage.blob`; `contracts/image-annotation.md` §3).
- [ ] T025 [US2] Create `src/infra/images.ts` — the IndexedDB `images` store and the decoded cache (`data-model.md images.*`): `put` writes once and decodes, `get` answers the decoded picture or null, `ready` resolves every picture decoded, `load` reads them back for a restore, `clear` lets both go. Decode with an `HTMLImageElement` and an object URL (revoked on clear), as `src/infra/takes.ts` does.
- [ ] T026 [US2] Change `src/infra/clip-store.ts`: `DB_VERSION` 2 → 3, create the `images` object store, and make `clear()` clear it with the takes and the meta (`data-model.md` "the clip store").
- [ ] T027 [US2] In `src/ui/keeping/resume-flow.ts`, after `restore` succeeds, load the kept pictures into the cache so a restored image draws.
- [ ] T028 [US2] In `src/ui/lifecycle/view-lifetime.ts`, clear the image cache with the session, beside the other view resets.
- [ ] T029 [US2] Create `src/ui/annotating/image-plugin.ts` (`contracts/image-annotation.md` §2): `begin` offers the three ways to choose a picture — a hidden `<input type="file" accept="image/*">`, a `paste` listener, and `dragover`/`drop` on the preview — live only while the image is being added; refuse an unreadable picture through `abandon`; downscale a picture larger than twice the clip's picture once, on add, and say so; place it centred at a default width fraction keeping its proportions; `images.put(id, blob)` **before** `commit`.
- [ ] T030 [US2] The image's `renderer` (in `src/ui/annotating/image-plugin.ts`) resolves `imageId` through `images.get` and `drawImage`s it into the rect, scaled to `w × h`, skipping a picture not yet decoded (`contracts/image-annotation.md` §4).
- [ ] T031 [US2] In `src/ui/exporting/export-flow.ts`, await `images.ready()` before the encoder starts, so every picture is decoded before the frame loop (`contracts/image-annotation.md` §4).
- [ ] T032 [US2] Register the image plugin in `src/main.ts` beside the arrow's.

### Verification for User Story 2

- [ ] T033 [US2] Browser harness `verify-annotations.html` (deleted before commit): a chosen picture is placed, drawn through the layer, and shown over its stretch in playback and not outside it; a bad file is refused with a message and nothing is added; the image is in hand so it can be moved and resized at once.
- [ ] T034 [US2] Browser harness `verify-annotations.html`: run `exportOffline(planExport(...))` (`src/ui/exporting/frame-renderer.ts`) after awaiting `images.ready()`, and assert the image and the arrow renderers both ran on the export canvas — the file matches the review (spec FR-011, SC-005).
- [ ] T035 [US2] Browser harness `verify-annotations.html`: the **shared operations on the image** — pick it, drag its body to move it, drag a corner to resize keeping proportions, hold Shift to stretch it free, copy and paste it, delete it and undo — the same gestures as the arrow (spec US1 scenario 1, FR-001…FR-007).
- [ ] T036 [P] [US2] Browser harness `verify-annotations.html`: the timeline lane (`src/ui/annotating/annotation-lane.ts`) shows a mark for the image at the start of its kept stretch with the kind's symbol, and clicking it picks the image and moves the playhead; a cut that removes part of the image's stretch stops it being drawn there.
- [ ] T037 [US2] The reload in the running app (`npm run dev`, `specs/003-annotation-plugins/quickstart.md` §3): place an image, reload, confirm it is back and drawn without being chosen again (spec FR-016, SC-006) — the one check that needs the real IndexedDB path in `src/infra/clip-store.ts`.

**Checkpoint**: Both kinds exist and are edited the same way. US1 and US2 are both independently functional.

---

## Phase 5: User Story 3 — A new kind is described, not fitted (Priority: P3)

**Goal**: Prove the promise the feature exists for (plan steps 6–7): a kind is added by describing it, edits nothing already there, and no existing kind, cut or shared behaviour changes outcome.

**Branch**: folded into `feat/image-annotation-plugin` and `docs/annotation-plugin-final` (the promise is largely *proved* by Phases 3–4 having added a kind without editing the arrow).

**Independent Test**: The image kind was added by describing only its shape, its drawing and its creation; the arrow, the cuts and every existing test are unchanged in outcome; a third kind registered in a test is picked up by the section's actions, the canvas and the register with no other edit.

### Verification for User Story 3

- [ ] T038 [US3] Confirm and record that adding the image kind changed the outcome of no existing arrow or cut test (spec SC-002) — run `npx vitest run` over `src/domain/annotation/` and `src/domain/clip/` and diff the outcomes against Phase 3's T018 (`specs/003-annotation-plugins/quickstart.md` §1).
- [ ] T039 [P] [US3] Extend `src/ui/annotating/annotation-plugin.test.ts` with a third, throwaway plugin registered only in the test, proving the section's actions, `pluginOf`/`plugins` and the canvas's `add` pick it up with no edit to any existing kind (`contracts/annotation-plugin.md` §"Adding the next kind").
- [ ] T040 [P] [US3] Extend `src/domain/annotation/kinds.test.ts` so the existing `Dot` stub still registers and restores through `kinds.ts` — the domain half of the promise is unbroken.
- [ ] T041 [US3] Make the timeline lane's mark symbol come from the plugin's `action.icon` in `src/ui/annotating/annotation-lane.ts`, so a new kind is found on the lane without editing it.

**Checkpoint**: The promise holds — a kind is a class, a line in the register, and a plugin.

---

## Phase 6: Polish & Cross-Cutting Concerns (branch `docs/annotation-plugin-final`)

**Purpose**: The docs and the final verification (plan step 7).

- [ ] T042 [P] Update the help modal text in `index.html` to describe the image and the shared editing (the arrow's paragraph already there gains the image beside it).
- [ ] T043 [P] Update `FEATURES.md`'s annotations entry with the image kind and the shared gestures.
- [ ] T044 [P] Update the module map in `README.md` for `ui/annotating/` (the plugin, the canvas, the two plugin files) and `infra/images.ts`.
- [ ] T045 Run the full gate from `package.json`: `npm run lint && npm run typecheck && npx vitest run && npm run build`.
- [ ] T046 Run `quickstart.md` end to end and paste its output into the pull request, stating which Verification level each part got and what was not verified.
- [ ] T047 [P] Delete any `verify-*.html` harness left in the repository root and confirm none is committed.

**Checkpoint**: The change is documented and proved at all three Verification levels.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies; MUST land first (constitution V).
- **Foundational (Phase 2)**: depends on Phase 1; **blocks** Phases 3–5.
- **US1 (Phase 3)**: depends on Phase 2. No dependency on US2 or US3.
- **US2 (Phase 4)**: depends on Phase 2 and on US1's canvas and registry (a kind needs a canvas to be edited on). Independently testable once US1 lands.
- **US3 (Phase 5)**: mostly a *verification* of Phases 3–4; its T041 (lane icon) can land with US2.
- **Polish (Phase 6)**: depends on all desired stories.

### User Story Dependencies

- **US1 (P1)**: independent after Foundational. The MVP — the shared editing with the arrow alone.
- **US2 (P2)**: depends on US1's seam (the canvas and the plugin registry) but not on US1's arrow internals. It also **completes US1's scenario 1**: the two-kind check is T035.
- **US3 (P3)**: depends on US2 existing (the image is the evidence), and is otherwise independent.

> **Honest note**: the spec's US1 scenario 1 is "a clip with an arrow and an image", so it cannot pass before the image kind exists. US1's scenarios 2–5 pass with the arrow alone and are the MVP; T035 closes scenario 1 in Phase 4.

### Within Each User Story

- Tests beside a rule are written with the rule (T019/T022 together, T005/T009 together).
- The domain kind before the store; the store before the plugin; the plugin before the harness.
- The register in `kinds.ts` and the plugin registry are what make a kind reachable; neither exists before its kind's class.

### Parallel Opportunities

- Phase 1: T001 and T002 (glossary vs skills).
- Phase 2: T003 and T004 (domain file vs view file).
- Phase 3: T005, T006, T007 (three different files) can start together; T013 is independent of the canvas rewrite.
- Phase 4: T019, T020, T021 (three test files) together; T022 and T024 (domain kind vs port) together.
- Phase 6: T042, T043, T044 (three docs files) together.

---

## Parallel Example: User Story 1

```bash
# The three files that can be written at once in Phase 3:
Task: "Add src/ui/annotating/annotation-plugin.test.ts (T005)"
Task: "Update src/ui/annotating/annotation-layer.test.ts imports (T006)"
Task: "Create src/ui/annotating/arrow-plugin.ts (T007)"
```

## Parallel Example: User Story 2

```bash
# The kind's tests and the seam's port, at once:
Task: "Add src/domain/annotation/ImageAnnotation.test.ts (T019)"
Task: "Extend src/application/restore-clip.test.ts and keep-clip.test.ts (T020)"
Task: "Add src/infra/images.test.ts (T021)"
Task: "Add src/application/ports/ImageStorePort.ts (T024)"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 (the words) → Phase 2 (the types) → Phase 3 (US1).
2. **STOP and VALIDATE**: the arrow behaves exactly as before, the shared canvas is real, the section's action still draws an arrow, and every existing arrow and cut test passes (only the one import moved).
3. This is shippable and delivers the seam the whole feature is.

### Incremental Delivery

1. Phases 1–3 → the seam, shipped with the arrow (MVP).
2. Phase 4 → the image kind, shipped: the second kind proves the seam and completes US1's scenario 1.
3. Phase 5 → the promise recorded and the third-kind and stub tests in place.
4. Phase 6 → the docs and the full verification.

Each phase is its own pull request; the user merges, and CI owns the version.

### Parallel Team Strategy

With more than one person: Phase 1–2 together; then one person on Phase 3 (the seam) while the image kind's **domain and tests** (T019–T023) are written in parallel, since the class depends only on Phase 2's types. The image's store and plugin wait on Phase 3's canvas.

---

## Notes

- [P] tasks are different files with no dependency between them.
- [Story] labels map each task to its spec story; Setup, Foundational and Polish tasks carry none.
- A harness (`verify-*.html`) is never committed; its output goes in the pull request.
- One deliberate departure is expected: `annotation-layer.test.ts`'s imports move with the arrow's renderer and metrics (T006). Name it in the pull request; keep its assertions.
- The recorder's flow is untouched; the real screen share stays the user's to run and is stated as a gap.
- Avoid: editing an existing kind to add a new one (that is the thing US3 forbids); putting a `Blob` in `src/domain/`; writing a picture into the clip's small half.
