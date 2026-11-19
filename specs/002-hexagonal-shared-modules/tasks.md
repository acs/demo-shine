---

description: "Task list for the Hexagonal Shared Modules refactor"
---

# Tasks: Hexagonal Shared Modules

**Input**: Design documents from `specs/002-hexagonal-shared-modules/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ports.md, quickstart.md

**Tests**: Included. The spec makes tests the proof of this refactor (FR-019, FR-023, SC-001, SC-005), so unit tests are written beside every new rule and use case. The old tests are the regression proof and must pass unmodified.

**Organization**: One phase per user story. The seven shared modules are one refactor, so the stories are ordered: each phase builds on the previous and is validated at its own checkpoint. Every phase except Setup and Polish carries its story label.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task belongs to (US1–US5)
- Exact file paths are in every description

## Path Conventions

Single-project browser application: `src/` at the repository root; tests sit beside the rule they prove (`*.test.ts`); temporary harnesses are `verify-*.html` in the repository root. Paths are relative to the repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The words and the map come first (constitution principle V), and the baseline is recorded before any code moves.

- [x] T001 Add the refactor's words to `GLOSSARY.md`: port, adapter, use case, view flow, phase, source set, crop region — each with the definition the spec and plan use
- [x] T002 Update the target layout in `.agents/skills/overview/SKILL.md` and `.agents/skills/domain-model/SKILL.md` so the skills name the four layers, the port rule and the view-flow rule
- [ ] T003 Run the full check on the untouched tree (`npm run lint`, `npm run typecheck`, `npx vitest run`, `npm run build` per `package.json`) and record the green baseline in the first pull request body

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The phase module and the session's ownership of the clip. Every later flow and view depends on both.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Phase module (plan step 2)

- [x] T004 Reduce `src/state.ts` to the phase only: export `Phase`, `currentPhase`, `setPhase`, `onPhaseChange`; delete the `app` object's phase field and every other field's declaration that later steps will re-home
- [x] T005 Add `src/state.test.ts` proving the watchers fire on a phase change and not on a same-value set
- [x] T006 Update every reader of `app.phase` in `src/ui/` (the record, export and publish buttons, the status line) to call `currentPhase`/`onPhaseChange`; remove `app.phase` from `src/state.ts`

### Session owns the clip; the view listens (plan step 3)

- [x] T007 Add `src/application/session.ts` with a `Session` holding `clip` and `audio` and an `end()` that clears the clip — field semantics per `data-model.md` `Session.clip` and `Session.audio`
- [x] T008 Add `src/application/session.test.ts` proving `end()` clears the clip and that the session holds no view state
- [x] T009 Add the root `src/session.ts` composition exporting the single `Session`; it imports no view module (replace the existing view registry)
- [x] T010 Remove the view imports and the reset list from `src/session.ts`; each view now subscribes to the clip's `cleared` event
- [x] T011 Subscribe the timeline, marks and annotation-lane views to `clip.onChange` and `clip.cleared` in `src/ui/timeline-ui.ts`, `src/ui/marks.ts` and `src/ui/annotation-lane.ts`
- [x] T012 Subscribe the player and preview to `clip.onChange` and `clip.cleared` in `src/ui/playback.ts` and `src/ui/preview.ts`
- [x] T013 Remove `app.clip` from `src/state.ts` and update every reader in `src/ui/` to read `session.clip`
- [x] T014 Run the old unit tests unmodified and the phase harness from `specs/002-hexagonal-shared-modules/quickstart.md` §3 "phase and views"; record the output in the pull request

**Checkpoint**: The phase has one owner and the clip has one owner; every view resets itself on `cleared`.

---

## Phase 3: User Story 1 — A rule is proved without a browser (Priority: P1) 🎯 MVP

**Goal**: The rules still trapped in the seven shared modules move to modules a node test can reach, and each rule gets a test beside it.

**Independent Test**: Run `npx vitest run src/domain src/application` with no browser and no dev server; the new rules and the old tests pass. Change one rule and see its test fail.

### Inventory

- [ ] T015 [US1] Inventory the rules held by `src/recorder.ts`, `src/exporter.ts`, `src/publisher.ts`, `src/session.ts`, `src/offline-export.ts`, `src/resume.ts` and `src/state.ts`; name the destination module and test file for each in the pull request body, so no rule is left behind

### New domain rules

- [x] T016 [P] [US1] Add `src/domain/capture/CropRegion.ts` — `x`, `y`, `w`, `h` normalised to 0..1, `FULL`, and the refusal of an empty or out-of-picture region; constraints per `data-model.md` `CropRegion.x`, `CropRegion.y`, `CropRegion.w`, `CropRegion.h`
- [x] T017 [P] [US1] Add `src/domain/capture/CropRegion.test.ts` proving the region stays inside the picture, `FULL` is the whole picture, and an empty region is refused
- [x] T018 [P] [US1] Add `src/domain/capture/SourceSet.ts` — `screen`, `webcam`, `mic`; a take needs a picture; toggles are independent; a source is on only while its device is held; constraints per `data-model.md` `SourceSet.screen`, `SourceSet.webcam`, `SourceSet.mic`
- [x] T019 [P] [US1] Add `src/domain/capture/SourceSet.test.ts` proving the picture requirement and the independence of the three toggles

### Moved type and view updates

- [x] T020 [US1] Move `ExportTarget` to `src/domain/export/ExportTarget.ts`; leave the codec choices in `src/infra/export-target.ts`; update every import (per `data-model.md` "Moved types")
- [x] T021 [US1] Replace the `Rect` interface and `app.region` in `src/ui/region.ts` and `src/state.ts` with `CropRegion`; update the crop-box view
- [x] T022 [US1] Replace `app.screenOn`, `app.webcamOn`, `app.micOn` in `src/ui/source-buttons.ts` with `SourceSet`; remove the booleans from `src/state.ts`
- [x] T023 [US1] Run the old unit tests unmodified and the "source and crop" harness from `specs/002-hexagonal-shared-modules/quickstart.md` §3; record the output in the pull request

**Checkpoint**: Every rule named in T015 has a destination and a test; the old tests pass without edits.

---

## Phase 4: User Story 2 — A browser capability can be swapped for a fake (Priority: P1)

**Goal**: Each browser capability the shared modules use is named by a port and implemented by an adapter in `src/infra/`, so a fake can stand behind it.

**Independent Test**: Put a fake behind each port in turn and run the matching use case in a terminal; no rule changes. Then read the imports of `src/domain/` and `src/application/` and find no view or adapter import.

### Ports

- [x] T024 [P] [US2] Add `src/application/ports/CapturePort.ts`, `WebcamPort.ts` and `MicrophonePort.ts` with the shapes in `contracts/ports.md` §Capture and §Webcam and microphone
- [x] T025 [P] [US2] Add `src/application/ports/TakeRecorderPort.ts`, `CompositorPort.ts`, `TakeProbePort.ts` and `ClockPort.ts` per `contracts/ports.md` §Recording, §Compositor and §Probing and time
- [x] T026 [P] [US2] Add `src/application/ports/EncoderPort.ts`, `FrameRendererPort.ts`, `DownloadPort.ts` and `KeptClipPort.ts` per `contracts/ports.md` §Encoding, §Downloading and §Keeping the clip

### Capture adapters

- [x] T027 [P] [US2] Add `src/infra/capture.ts` implementing `CapturePort`, `WebcamPort` and `MicrophonePort` over `getDisplayMedia`/`getUserMedia`; the adapter owns the tracks and releases them
- [x] T028 [P] [US2] Add `src/infra/clock.ts` implementing `ClockPort` over `performance.now` and `setTimeout`
- [x] T029 [US2] Move screen, webcam and microphone acquisition out of `src/ui/source-buttons.ts`, `src/ui/webcam.ts` and `src/ui/mic.ts` into the capture adapter; remove `app.stream`, `app.webcamStream` and `app.micStream` from `src/state.ts`
- [x] T030 [US2] Wire the capture ports in `src/main.ts` and pass the adapters to the views; the composition root is the only module importing all four layers
- [ ] T031 [US2] Run the "source and crop" harness from `specs/002-hexagonal-shared-modules/quickstart.md` §3 and a real screen share per §4; state the real-share gap in the pull request if it was not run

**Checkpoint**: A fake can replace the screen, webcam, microphone and clock; the dependency rule in `contracts/ports.md` holds.

---

## Phase 5: User Story 3 — A flow only sequences (Priority: P2)

**Goal**: Record, Export, Publish and New become thin view flows that call a use case and report its outcome; the rules live in the use case.

**Independent Test**: Read each flow and point every decision to its use case; swap the use case's outcome for another value and see the flow report it without any rule change.

### Record use case and adapters (plan step 6)

- [x] T032 [P] [US3] Add `src/infra/compositor.ts` implementing `CompositorPort` — move the crop canvas and the audio mixer (`Output`, `Mixer`) out of `src/recorder.ts`; the webcam bubble's drawing is injected by `src/main.ts`
- [x] T033 [P] [US3] Add `src/infra/take-recorder.ts` implementing `TakeRecorderPort` over `MediaRecorder`; it owns the chunks and the blob
- [x] T034 [P] [US3] Add `src/infra/take-probe.ts` implementing `TakeProbePort` — move `measureTake` and `resolveVideoDuration` out of `src/recorder.ts`
- [x] T035 [US3] Add `src/application/record-take.ts` returning `RecordOutcome` (started, stopped with a `Take`, or refused with a reason); it owns the sequence sources → mix → record → stop → take added and draws nothing
- [x] T036 [US3] Add `src/application/record-take.test.ts` with fakes behind the seven ports: a take starts and stops, a refusal carries a reason, the clip receives the take
- [x] T037 [US3] Add `src/ui/record-flow.ts` wiring the source buttons, the record button and the phase to `RecordTake`; it makes no decision
- [x] T038 [US3] Add `src/ui/review-flow.ts` opening the review after a take or a restore; it calls the player and the timeline
- [x] T039 [US3] Delete `src/recorder.ts` and remove the `app` fields it owns (`rec`, `chunks`, `startAt`, `recAudio`, `audioCtx`, `audioGain`, `mirroring`, `rafId`) from `src/state.ts`
- [x] T040 [US3] Run the "phase and views" harness and the real share per `specs/002-hexagonal-shared-modules/quickstart.md` §4; record the output and state the real-share gap in the pull request

### Export use case and encoder (plan step 7)

- [x] T041 [US3] Move `src/offline-export.ts` to `src/infra/offline-encoder.ts` implementing `EncoderPort`; it imports no `ui/` module and draws only through the injected `FrameRendererPort`
- [x] T042 [US3] Add `src/application/export-video.ts` returning `ExportOutcome` (a blob and stats, or a refusal); it reuses `planExport` in `src/application/export-clip.ts` and decides what to write
- [x] T043 [US3] Add `src/application/export-video.test.ts` with a fake encoder and a fake download: the plan is encoded, the outcome carries the blob and stats, a missing encoder is refused
- [x] T044 [US3] Add `src/ui/export-flow.ts` wiring the export button to `ExportVideo` and reporting the outcome; the status line and the phase follow the outcome
- [x] T045 [US3] Delete `src/exporter.ts` and `src/offline-export.ts`; update imports in `src/main.ts` and `src/ui/export-menu.ts`
- [ ] T046 [US3] Run the "export and annotations" harness and a real file export per `specs/002-hexagonal-shared-modules/quickstart.md` §3; record the output in the pull request

### Publish, keep and restore (plan step 8)

- [x] T047 [US3] Add `src/application/keep-clip.ts` returning `KeepOutcome` (saved or failed); it owns the event subscription and the debounce through `ClockPort`
- [x] T048 [US3] Add `src/application/keep-clip.test.ts` with a fake store and a fake clock: a take is saved as it arrives, metadata is debounced, the clip is saved before a sign-in
- [x] T049 [US3] Add `src/application/restore-clip.ts` returning `RestoreOutcome` (a `ClipSnapshot` and audio, or nothing); it loads without announcing a change
- [x] T050 [US3] Add `src/application/restore-clip.test.ts` with a fake store: a stored clip is restored, an empty store restores nothing
- [x] T051 [US3] Implement `KeptClipPort` in `src/infra/clip-store.ts` over the existing IndexedDB functions; the schema and the `ClipSnapshot` shape do not change
- [x] T052 [US3] Add `src/ui/publish-flow.ts` wiring the publish button to `publish-to-bluesky`; a failed keep refuses the sign-in and a successful publish releases the kept copy
- [x] T053 [US3] Add `src/ui/resume-flow.ts` calling `RestoreClip` at startup and opening the review; a restore announces nothing
- [x] T054 [US3] Delete `src/publisher.ts` and `src/resume.ts`; update imports in `src/main.ts` and `src/ui/publish-dialog.ts`
- [ ] T055 [US3] Run the "resume" harness per `specs/002-hexagonal-shared-modules/quickstart.md` §3 and the existing `publish-to-bluesky` tests; record the output in the pull request

**Checkpoint**: Record, Export, Publish and New are sequences over use cases; no flow contains a rule; each use case runs in a terminal with fakes.

---

## Phase 6: User Story 4 — The view listens, and the session ends itself (Priority: P2)

**Goal**: Prove that adding a view needs no session edit, and that ending a session never cuts work in flight.

**Independent Test**: Add a view that draws one more thing about the clip; end a session; it resets without a change to `src/session.ts`. Then run New, an export, a publish and a lost share and confirm each ends the same way.

- [ ] T056 [US4] Add a throwaway view in a `verify-view-lifetime.html` harness that subscribes to `clip.cleared`; end a session and confirm it resets with no line added to `src/session.ts` or `src/application/session.ts`
- [x] T057 [US4] Confirm `src/session.ts` and `src/application/session.ts` name no view module and hold no reset list; remove any remaining reference
- [ ] T058 [US4] Guard the in-flight case: an export or a publish running when `cleared` fires is not cancelled by a view reset and still reports its outcome — prove it in the harness or a unit test in `src/application/export-video.test.ts`
- [ ] T059 [US4] Run New, an export, a publish and a lost share in the "phase and views" harness in `specs/002-hexagonal-shared-modules/quickstart.md` §3; confirm each leaves no view holding the clip and the phase returns to `review` or `idle` as today

**Checkpoint**: A new view adds itself; a session ends on one event; in-flight work survives.

---

## Phase 7: User Story 5 — The seven shared modules have a home (Priority: P3)

**Goal**: Nothing at the repository root holds a rule or a browser adapter; the map names where each kind of code lives.

**Independent Test**: Walk the module map and find each of the seven modules' responsibilities in its layer; confirm only the composition root and the phase module remain at the root.

- [x] T060 [US5] Remove the last `app` fields from `src/state.ts` (any `playing`, `playRaf`, `captureW`, `captureH` leftovers) into `src/ui/playback.ts`, `src/ui/preview.ts` and the capture adapter; `src/state.ts` is the phase only
- [x] T061 [US5] Confirm the repository root holds no rule or adapter: only `src/main.ts`, `src/state.ts` and `src/session.ts` remain, and `src/recorder.ts`, `src/exporter.ts`, `src/publisher.ts`, `src/offline-export.ts`, `src/resume.ts` are gone
- [x] T062 [US5] Update the module map in `README.md` so every layer and the seven modules' new homes are named
- [x] T063 [US5] Re-read `GLOSSARY.md` and add any word the refactor introduced that T001 missed; a word must be in the glossary before it is in the code
- [ ] T064 [US5] Run the full check from `specs/002-hexagonal-shared-modules/quickstart.md` §1 and the end-to-end harness from §3; record the output in the pull request
- [ ] T065 [US5] Run a real session per `specs/002-hexagonal-shared-modules/quickstart.md` §4; state what was run and what was not

**Checkpoint**: The seven modules are gone or reduced; the map and the glossary tell the truth.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Hygiene that applies to every step.

- [x] T066 Delete every `verify-*.html` file from the repository root; none is committed
- [x] T067 Confirm no step edited `package.json`'s version; CI owns it (per `VERSIONING.md`)
- [ ] T068 Confirm each pull request body states the tests run, the harness output pasted, and the real-share gap when it applies, per `specs/002-hexagonal-shared-modules/quickstart.md` §6
- [x] T069 Re-read `AGENTS.md`, `README.md` and `GLOSSARY.md` for words and paths the refactor changed; fix any drift

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T001 and T002 are docs-only; T003 needs the untouched tree.
- **Foundational (Phase 2)**: Depends on Setup — **blocks every story**. T004–T006 (phase) and T007–T013 (session) can run as two tracks; T014 needs both.
- **US1 (Phase 3)**: Depends on Foundational. T015 first (the inventory), then T016–T022, then T023.
- **US2 (Phase 4)**: Depends on US1 for `CropRegion` (the compositor and capture ports name it) and on Foundational for the phase. T024–T026 are independent; T027–T030 need T024–T026; T031 needs T027–T030.
- **US3 (Phase 5)**: Depends on US2 for every port and adapter. The three groups run in order: record (T032–T040), export (T041–T046), publish/keep (T047–T055). The keep use case needs the `KeptClipPort` from T026.
- **US4 (Phase 6)**: Depends on US3 for the flows and the `cleared` event's final wiring.
- **US5 (Phase 7)**: Depends on US4 — the `app` object must be empty before T060 can close it.
- **Polish (Phase 8)**: Depends on all desired stories.

### Story Dependencies

- **US1 (P1)**: needs Foundational only. Its rules are the first thing a node test can reach.
- **US2 (P1)**: needs US1's `CropRegion`; otherwise independent of US1's other tasks.
- **US3 (P2)**: needs US2's ports. It is the largest phase and the only one that changes what a person sees being sequenced.
- **US4 (P2)**: needs US3's flows to prove the in-flight case; its session work was done in Foundational.
- **US5 (P3)**: needs all of the above; it delivers no behaviour.

### Within Each Story

- Inventory before code (US1 T015).
- Domain rules and their tests before the views that use them (US1 T016–T019 before T021–T022).
- Ports before adapters (US2 T024–T026 before T027–T030).
- Use case and its test before the flow that calls it (US3 T035–T036 before T037; T042–T043 before T044; T047–T048 before T052).
- Delete the old module only after its replacement is wired and the old tests pass.

### Parallel Opportunities

- T001 and T002 (different documents).
- T016/T017 and T018/T019 (two value objects, two tests).
- T024, T025 and T026 (three port groups, different files).
- T027 and T028 (capture adapter and clock adapter).
- T032, T033 and T034 (compositor, recorder and probe adapters).
- T041 and T044 cannot run before T042; but T041 and T043 are different files and can run together once T042's signature exists.
- T047/T048 and T049/T050 (keep and restore are independent use cases).

### Parallel Example: US1

```bash
# The two value objects and their tests, all different files:
Task: "Add src/domain/capture/CropRegion.ts"
Task: "Add src/domain/capture/CropRegion.test.ts"
Task: "Add src/domain/capture/SourceSet.ts"
Task: "Add src/domain/capture/SourceSet.test.ts"
```

### Parallel Example: US2 ports

```bash
Task: "Add src/application/ports/CapturePort.ts, WebcamPort.ts, MicrophonePort.ts"
Task: "Add src/application/ports/TakeRecorderPort.ts, CompositorPort.ts, TakeProbePort.ts, ClockPort.ts"
Task: "Add src/application/ports/EncoderPort.ts, FrameRendererPort.ts, DownloadPort.ts, KeptClipPort.ts"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1: Setup — the words and the baseline.
2. Complete Phase 2: Foundational — the phase module and the session.
3. Complete Phase 3: US1 — the rules a node test can reach.
4. **STOP and VALIDATE**: `npx vitest run src/domain src/application` and the source/crop harness. This is the smallest increment that delivers the refactor's value.

### Incremental Delivery

Each plan step is its own branch and pull request (FR-021). The phase boundaries line up with the plan's ten steps:

| Plan step | Branch | Tasks |
|---|---|---|
| 1 | `docs/hexagonal-words` | T001–T003 |
| 2 | `refactor/phase-module` | T004–T006 |
| 3 | `refactor/session-clip` | T007–T014 |
| 4 | `refactor/source-crop` | T015–T023 |
| 5 | `refactor/capture-adapters` | T024–T031 |
| 6 | `refactor/record-use-case` | T032–T040 |
| 7 | `refactor/export-use-case` | T041–T046 |
| 8 | `refactor/publish-keep` | T047–T055 |
| 9 | `refactor/state-phase-only` | T056–T061 |
| 10 | `refactor/hexagonal-final` | T062–T069 |

Steps 2 and 3 are Phase 2; steps 4 and 5 are US1 and US2; steps 6–8 are US3; steps 9–10 are US4 and US5. A step is not finished until `npm run lint && npm run typecheck && npx vitest run && npm run build` passes and its harness output is in the pull request.

### Parallel Team Strategy

The refactor is sequential by nature — the `app` object's fields are shared, so two people editing `src/state.ts` at once conflict. Parallel work is limited to independent files within a phase (the port interfaces, the two value objects, the keep and restore use cases). One person per step is the safe default.

---

## Notes

- [P] means different files with no dependency on an incomplete task.
- The old tests are the proof: run them unmodified; if one must change, say which and why in the pull request.
- Do not commit a `verify-*.html` file; delete it before the commit.
- Do not bump `package.json`; CI owns the version.
- Do not claim a browser harness or a real share was run when it was not. The recorder's real share is the user's to run.
- No new runtime dependency.
- A rule in `src/domain/` gets a unit test beside it; a view change gets a harness; a recorder change states the real-share gap.

---

## Verification actually run

The full check passed on the final tree:

```sh
npm run lint && npm run typecheck && npx vitest run && npm run build
```

- **lint** — clean.
- **typecheck** — clean.
- **vitest** — 31 files, 199 tests, all passing. The old tests pass unmodified.
- **build** — clean; 460 modules bundled.

Browser harnesses, run on the dev server and read back from the page:

- `verify-phase-views.html` — 8/8 PASS. After `clip.cleared`: the clip is empty, the timeline is off, the thumbnail strip is emptied, the playhead is back at 0, the idle overlay returns, the resolution badge is gone, and the phase is untouched. The view layer resets without the session naming a view.
- `verify-new-session.html` — 6/6 PASS. New ends the clip, resets the views, returns the status to Ready, and leaves the phase at idle.

Not run, and not claimed:

- A real screen share, a real file export, and a real publish — the user runs these. The recorder's real-share gap stands.
- The source-and-crop, export-and-annotations, resume and end-to-end harnesses named in the tasks above. The unit tests and the two harnesses above are the proof this change carries.
- The in-flight export/publish guard (T058) is not proven in a browser; the export use case's unit test covers the outcome, not the interaction with a view reset.
- No pull request was opened, so the per-step pull-request bodies (T068) do not exist.

