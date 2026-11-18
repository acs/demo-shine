---

description: "Task list for Video Annotations"
---

# Tasks: Video Annotations

**Input**: Design documents from `specs/001-video-annotations/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — this repository's own rules require a unit test beside every
rule in `src/domain/`, and a browser harness for anything drawn, played or encoded
(`.agents/skills/verification`). The test tasks below are therefore not optional here.

**Organization**: Tasks are grouped by user story so each can be implemented and
proved on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1, US2, US3 (from spec.md)
- Exact file paths are in every description

## Path Conventions

Single project, this repository's layout: `src/domain/`, `src/ui/`, `src/infra/`, flows
at `src/` root (see plan.md → Project Structure).

---

## Phase 1: Setup

**Purpose**: The one precondition this repository puts before any code — the words.

- [x] T001 Name the new words in `GLOSSARY.md` first — `annotation`, `annotation kind`, `arrow`, and the widened `selection` — before any code uses them (the repository's rule: a new concept is written there first)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The annotation family in the domain, the clip holding it, the drawing
seam, and the persistence — everything every user story stands on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 [P] The annotation value in `src/domain/annotation/Annotation.ts`, with `src/domain/annotation/Annotation.test.ts` — id, kind, span, geometry; the span is a `Span` and the geometry is normalised through its kind on the way in (data-model.md `Annotation.id`, `Annotation.kind`, `Annotation.span`, `Annotation.geometry`)
- [x] T003 [P] The kind registry in `src/domain/annotation/kinds.ts` — the `AnnotationKind<G>` descriptor (id, defaultGeometry, normalize, isUsable), `register()` and `kindOf()`, with `null` for an unknown id (contracts/annotation-kind.md)
- [x] T004 The arrow kind in `src/domain/annotation/Arrow.ts`, with `src/domain/annotation/Arrow.test.ts` — `ArrowGeometry`, `normalize()` clamping both points into `[0, 1]²`, `isUsable()` false below a small minimum length (data-model.md `ArrowGeometry.from`, `ArrowGeometry.to`)
- [x] T005 The annotation set in `src/domain/annotation/AnnotationSet.ts`, with `src/domain/annotation/AnnotationSet.test.ts` — identity (a duplicate id is refused), overlap **allowed** (unlike `SpanSet`), `at(moment)` in a stable order, `change`/`remove`, `rebase(factor)` (data-model.md `AnnotationSet` rules)
- [x] T006 The clip holds the annotations and the one undo in `src/domain/clip/Clip.ts`, with `src/domain/clip/Clip.test.ts` — `addAnnotation`/`changeAnnotation`/`removeAnnotation`/`annotationsAt`, re-base on `addTake`, `clear`, `snapshot`/`restore`, the three events, and `lastChange` replacing `lastApproved` so `undo()` takes back the last change of any kind (data-model.md `Clip.annotations`, `Clip.lastChange`, `ClipSnapshot.annotations`; spec FR-014, FR-015)
- [x] T007 Keep the annotations with the clip in `src/infra/clip-store.ts` (the `Meta` record's `annotations`) and `src/resume.ts` (they ride the existing `saveMeta` path) (data-model.md `ClipSnapshot.annotations`)
- [x] T008 The renderer registry and the shared layer in `src/ui/annotation-layer.ts` — the `AnnotationRenderer<G>` interface (draw, hitTest, handles), `register()`, and `drawAnnotations(ctx, w, h, annotations, selectedId)` with the arrow renderer registered (contracts/annotation-kind.md)
- [x] T009 [P] Carry the annotations to the export in `src/domain/clip/ExportPlan.ts` and `src/application/export-clip.ts`, with `src/domain/clip/ExportPlan.test.ts` (data-model.md `ExportPlan.annotations`)

**Checkpoint**: the family exists and is proved in node; the clip holds it; the layer can draw it.

---

## Phase 3: User Story 1 - Point at a detail with an arrow (Priority: P1) 🎯 MVP

**Goal**: select a stretch, add an arrow to it, and see the arrow over the detail in
playback and in the export.

**Independent Test**: with a finished clip in review, select a stretch, draw an arrow
onto a detail, then play the clip and export it — the arrow appears over that detail
for that stretch, and nowhere else (spec US1).

- [x] T010 [US1] Extract the pending section out of `src/ui/marks.ts` into `src/ui/selection.ts` (the marks and `section()`), and have `marks.ts` read it — the selection stops meaning "a cut" (data-model.md `Selection.marks`, `Selection.section()`; spec FR-013)
- [x] T011 [US1] Add the Annotate action to the section in `index.html`, `styles.css` and `src/ui/marks.ts`, starting the arrow gesture with the selected section as its span; keep the "click inside to cut" shortcut (spec FR-001, FR-013)
- [x] T012 [P] [US1] The arrow gesture on the picture in `src/ui/annotation-edit.ts` — a gesture object (down/move/up) that turns a drag on the preview in review into a normalised `Annotation` and calls `clip.addAnnotation`; its view state in `src/state.ts` and its cancel in `src/session.ts` (spec FR-002, FR-003, FR-004)
- [x] T013 [US1] Draw the layer during playback — call `drawAnnotations` from `src/ui/playback.ts` after `drawClipFrame`, at the current moment of the recording (spec FR-005)
- [x] T014 [US1] Draw the layer into the export — call `drawAnnotations` from `src/offline-export.ts` after `frame.draw(...)` and before `video.add(...)`, using the plan's annotations at the frame's moment (spec FR-006)
- [x] T015 [US1] Browser harness `verify-annotations.html` for US1 — place an arrow by hand-built state, play, and export; report through `<pre id="verify">` (quickstart.md §2)

**Checkpoint**: User Story 1 is fully functional and testable on its own — the MVP.

---

## Phase 4: User Story 2 - Change or remove an arrow (Priority: P2)

**Goal**: pick an arrow, move it and aim it, change the stretch it shows over, delete
it, and take any of it back with the one undo.

**Independent Test**: place an arrow, then move it, change its stretch, delete it, and
undo — each change shows in playback and the export (spec US2).

- [x] T016 [US2] The timeline lane in `src/ui/annotation-lane.ts` with `index.html`, `styles.css` and the redraw hook in `src/ui/timeline-ui.ts` — each annotation's **kept** stretch (mapped through `keptOf`/`keptLengthNow`), clickable to select it and move the playhead (spec FR-016, SC-007)
- [x] T017 [P] [US2] Pick and drag on the picture in `src/ui/annotation-edit.ts` — hit-test with the renderer to select, drag a handle to change an end, and `clip.changeAnnotation` (spec FR-007)
- [x] T018 [P] [US2] Drag an annotation's span on the lane in `src/ui/annotation-lane.ts` — `clip.changeAnnotation` with the new span (spec FR-007)
- [x] T019 [US2] Delete an arrow, and make the header's one undo say what it will take back and reverse it, in `src/ui/marks.ts` and `src/ui/timeline-ui.ts` (`el.tCut`, `el.cutUndo`) (spec FR-008, FR-015)
- [x] T020 [US2] Browser harness `verify-annotations-edit.html` — pick, drag an end, drag the span, delete, undo (quickstart.md §2)

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - The next kind fits the same frame (Priority: P3)

**Goal**: prove the seam — a second kind is added without touching the arrow or the
cuts.

**Independent Test**: register a throwaway second kind, then confirm every arrow and
cut behaves exactly as before (spec US3).

- [x] T021 [US3] Domain seam test in `src/domain/annotation/kinds.test.ts` — register a throwaway second kind and assert `AnnotationSet` and `Clip` behave generically and the arrow's own rules are unchanged (spec FR-011, SC-005)
- [x] T022 [P] [US3] Renderer seam test — register a second renderer and assert `drawAnnotations` draws both without changing what the arrow draws (spec FR-011)

**Checkpoint**: all three stories are independently functional, and the family is open.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T023 [P] Add the feature to `FEATURES.md` and the usage to `README.md`
- [x] T024 [P] Update the help panel in `index.html` with the arrow, in the repository's words
- [x] T025 Run the gate: `npm run lint && npm run typecheck && npx vitest run && npm run build`
- [x] T026 Run the `quickstart.md` validation end to end, and paste its output into the pull request

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 first — the glossary entry precedes the code.
- **Foundational (Phase 2)**: T002 and T003 first; T004 and T005 after T003/T002; T006 after T005; T007 after T006; T008 after T004; T009 after T002. Blocks every story.
- **User Stories (Phase 3+)**: all depend on Phase 2. They can run in parallel, or in priority order.
- **Polish (Phase 6)**: after the stories it documents.

### User Story Dependencies

- **US1 (P1)**: after Foundational — no dependency on other stories.
- **US2 (P2)**: after Foundational; it edits the modules US1 introduces (`annotation-edit.ts`, `annotation-layer.ts`), so in practice it follows US1.
- **US3 (P3)**: after Foundational; independent of US1/US2 (it only reads the registries).

### Within Each Story

- Models and rules before the view that uses them (Phase 2 before Phase 3).
- The gesture before the wiring that starts it.
- Implementation before the harness that proves it.

### Parallel Opportunities

- **Foundational**: T002 and T003 together; then T009 alongside T005/T006 (different files).
- **US1**: T012 (the gesture) can be built alongside T010/T011 (the selection and its action) — different files.
- **US2**: T017 (the picture) and T018 (the lane) are different files and can be built together.
- **US3**: T022 alongside T021.
- **Polish**: T023 and T024 together.

---

## Parallel Example: User Story 2

```bash
# The two editing surfaces are different files and can be built together:
Task: "T017 [P] [US2] Pick and drag on the picture in src/ui/annotation-edit.ts"
Task: "T018 [P] [US2] Drag an annotation's span on the lane in src/ui/annotation-lane.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: the words in `GLOSSARY.md`.
2. Phase 2: the family, the clip, the layer, the persistence — the blocking part.
3. Phase 3: US1 — select, draw, play, export.
4. **STOP and VALIDATE**: run the US1 harness and the domain tests; this is a shippable
   increment (an arrow that appears in the file).

### Incremental Delivery

1. Foundational → the family proved in node.
2. US1 → the MVP; ship it.
3. US2 → editing, the timeline lane, delete and undo.
4. US3 → the seam proved; the family is open for the next kind.
5. Polish → docs, help panel, the gate, quickstart.

### Notes

- [P] = different files, no dependency on an incomplete task.
- Each task in `src/domain/` carries its test beside it — that is the repository's rule,
  not an add-on.
- Per `.agents/skills/project-workflow`, each phase (and each user story within it) is
  its own branch and pull request; CI owns the version, so `package.json` is never
  bumped by hand.
