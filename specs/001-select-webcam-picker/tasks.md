# Tasks: Webcam Picker

**Input**: Design documents from `/specs/001-select-webcam-picker/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/camera-picker.md, quickstart.md

**Tests**: The plan calls for a Vitest unit test for the pure helpers and a browser harness for the picker's DOM behaviour; the actual camera switch is verified in a real session. The feature spec does not request TDD.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/` at the repository root; tests sit beside their files as `*.test.ts` (there is no `tests/` directory)
- Markup in `index.html`, styles in `styles.css`, both at the repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The element, its registry entry, and its styles.

- [x] T001 Add `<select id="cam-pick" hidden aria-label="Camera"></select>` immediately after `#webcam-btn` in `index.html`
- [x] T002 Register `camPick: byId<HTMLSelectElement>('cam-pick')` in `src/ui/dom.ts`
- [x] T003 [P] Add `.cam-pick` styles beside the source-button rules in `styles.css`, including a `[hidden]` rule that keeps the picker out of the layout

**Checkpoint**: The element exists and is hidden; the app still builds.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure list helpers and their unit test, used by every story.

- [x] T004 [P] Create `src/ui/camera-list.ts` with `cameraLabel`, `cameraOptions`, and `shouldShowPicker`; `cameraOptions` reads `Camera.label` and `Camera.deviceId` from `data-model.md` and falls back to `Camera N` for empty labels
- [x] T005 Create `src/ui/camera-list.test.ts` covering empty labels, duplicate labels, and the `shouldShowPicker` predicate from `data-model.md` (`Picker view state.visible`)

**Checkpoint**: `npx vitest run src/ui/camera-list.test.ts` passes.

---

## Phase 3: User Story 1 - Choose a camera when multiple are available (Priority: P1) 🎯 MVP

**Goal**: Detect all video inputs, show the picker when more than one is present and the webcam is on, start the device's default camera, and switch to the chosen camera.

**Independent Test**: With two cameras, turn the webcam on; the picker lists both and the default is active; choosing the second updates the preview.

### Verification for User Story 1

- [x] T006 [P] [US1] Write the browser harness `verify-camera-picker.html` with stubbed `navigator.mediaDevices` and `getUserMedia`, asserting the picker's options and default selection; delete it before commit

### Implementation for User Story 1

- [x] T007 [US1] Add the camera list and selection state to `src/ui/webcam.ts`, using `Camera selection.deviceId` from `data-model.md` (nullable until the webcam starts)
- [x] T008 [US1] Implement the camera list in `src/ui/webcam.ts`: `detectWebcam()` enumerates `videoinput` devices (filter on `Camera.kind` from `data-model.md`) and `renderCameras()` builds the options with `cameraOptions` (shape `Picker view state.options` from `data-model.md`), sets `hidden` via `shouldShowPicker`, and keeps the selected option
- [x] T009 [US1] Update `startWebcam()` in `src/ui/webcam.ts` to read the active track's `deviceId` and mark the selected option
- [x] T010 [US1] Implement `switchWebcam(deviceId)` in `src/ui/webcam.ts`: open the chosen camera first, then stop the old stream and swap `app.webcamStream` / `el.wcv.srcObject`, update the selection and the preview
- [x] T011 [US1] Wire the `#cam-pick` change event in `src/main.ts` to call `switchWebcam` and then `syncSources()`
- [x] T012 [US1] Refresh the list on `devicechange` in `src/ui/webcam.ts` and stop the stream with a toast when the active camera disappears

**Checkpoint**: US1 works on its own; the picker appears and switches.

---

## Phase 4: User Story 2 - No picker for a single camera (Priority: P2)

**Goal**: Keep the interface simple when there is zero or one camera.

**Independent Test**: With one camera, turn the webcam on; no picker appears and the webcam starts.

### Implementation for User Story 2

- [x] T013 [US2] Ensure `renderCameras()` hides the picker when `shouldShowPicker` is false and `startWebcam()` leaves it hidden for a single camera in `src/ui/webcam.ts`
- [x] T014 [US2] Verify the zero-camera path leaves `#cam-pick` hidden and the webcam button disabled in `src/ui/webcam.ts` and `src/ui/source-buttons.ts`; adjust only if the existing path does not

**Checkpoint**: US2 works on its own; one camera shows no picker.

---

## Phase 5: User Story 3 - Change camera during a session (Priority: P3)

**Goal**: Let the user switch cameras again while the webcam stays on, and keep the choice for the session.

**Independent Test**: With the webcam on and a camera selected, choose another; the preview updates and the selection stays.

### Implementation for User Story 3

- [x] T015 [US3] Keep the selected device ID in module state across refreshes and phase changes in `src/ui/webcam.ts`, so the picker stays on the chosen camera
- [x] T016 [US3] Re-run `renderCameras()` after a switch so the selected option matches the live stream in `src/ui/webcam.ts`
- [x] T017 [US3] Disable `#cam-pick` while a take is `starting` or `recording` in `src/ui/source-buttons.ts` (using `Picker view state.enabled` from `data-model.md`) and re-enable it on the next phase

**Checkpoint**: US3 works on its own; re-selection works and the picker locks during a take.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification and cleanup.

- [x] T018 [P] Run `npx vitest run` and `npm run typecheck` against `src/`
- [ ] T019 [P] Run the `quickstart.md` scenarios on a device with two cameras and record the result — blocked: needs a real two-camera device; the sandbox has no camera
- [x] T020 Delete `verify-camera-picker.html` and confirm `git status` shows no harness files
- [x] T021 [P] Update the help text in `index.html` to mention the camera picker when several cameras are present

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T001 → T002; T003 is independent
- **Foundational (Phase 2)**: T004 → T005; both depend on Setup for the element only when the test imports the DOM, which it does not
- **User Story 1 (Phase 3)**: Depends on Setup and Foundational; T007 → T008 → T009 → T010 → T011; T012 depends on T008
- **User Story 2 (Phase 4)**: Depends on US1's `refreshCameras()`; T013 → T014
- **User Story 3 (Phase 5)**: Depends on US1's switch path; T015 → T016; T017 is independent of T015/T016 except for the element
- **Polish (Phase 6)**: Depends on all desired stories

### User Story Dependencies

- **US1 (P1)**: No dependencies on other stories; the MVP
- **US2 (P2)**: Depends on US1's `refreshCameras()` but is independently testable with one camera
- **US3 (P3)**: Depends on US1's switch path but is independently testable by re-selecting while the webcam is on

### Within Each User Story

- The harness (T006) is written before the implementation and fails first
- State before the refresh; refresh before the switch; the switch before the event wiring
- The device-change path (T012) follows the refresh

### Parallel Opportunities

- T003 (CSS) runs in parallel with T001/T002
- T004 and T005 are sequential
- T006 (harness) can be written in parallel with T007–T010 against the planned API
- T018 and T019 run in parallel after the stories; T021 runs in parallel with either

---

## Parallel Example: User Story 1

```bash
# The harness and the first implementation task touch different files:
Task: "Write verify-camera-picker.html with stubbed media APIs"
Task: "Add the camera list and selection state to src/ui/webcam.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run the harness and the two-camera scenario in `quickstart.md`
5. Deploy/demo if ready

### Incremental Delivery

1. US1 → validate → demo (the picker appears and switches)
2. US2 → validate with one camera (no picker)
3. US3 → validate re-selection and the lock during a take
4. Polish → run the suite, the quickstart, and remove the harness

### Notes

- [P] tasks touch different files and have no incomplete dependencies
- The actual camera switch needs a real device; the harness only proves the DOM behaviour
- Delete `verify-camera-picker.html` before committing; it is not part of the change
