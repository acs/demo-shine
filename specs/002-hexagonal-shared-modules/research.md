# Research: Hexagonal Shared Modules

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-19

This document records the decisions the plan depends on. Each decision names the alternatives considered and why the chosen one is the better fit for this project.

## 1. What "hexagonal" means here

**Decision**: Keep the existing four layers — `domain/`, `application/`, `infra/`, `ui/` — and enforce the dependency direction `domain ← application ← infra/ui`. A port is an interface the use case owns; an adapter in `infra/` implements it; a view flow in `ui/` sequences the browser work. The composition root in `main.ts` wires everything.

**Rationale**: The project already uses this shape. The Domain model skill already says where a rule belongs and that collaborators are ports. Introducing a new folder tree would add churn without changing the architecture. The spec's clarification chose no new top-level folders.

**Alternatives considered**:
- *New `ports/` and `adapters/` top-level folders.* Rejected: the existing layers already express the direction; the change would move every file for no architectural gain.
- *Rename the layers to hexagonal names.* Rejected: the project's words and skills already use `domain`, `application`, `infra`, `ui`; renaming would break the glossary and the skills.

## 2. The fate of `state.ts`

**Decision**: `state.ts` becomes the phase module only. It exports `Phase`, `currentPhase`, `setPhase`, `onPhaseChange`. Everything else it holds today moves to its owner:

| Field today | New owner |
|---|---|
| `phase` | `state.ts` |
| `clip` | `application/session.ts` (the `Session`) |
| `stream`, `webcamStream`, `micStream` | `infra/capture.ts` |
| `screenOn`, `webcamOn`, `micOn` | `domain/capture/SourceSet.ts` |
| `region`, `captureW`, `captureH` | `domain/capture/CropRegion.ts` and the capture adapter |
| `rec`, `chunks`, `startAt` | `infra/take-recorder.ts` |
| `recAudio`, `audioCtx`, `audioGain` | the `Session` and `infra/compositor.ts` |
| `mirroring`, `rafId` | `ui/preview.ts` |
| `playing`, `playRaf` | `ui/playback.ts` |

**Rationale**: The spec's clarification chose a slim `state.ts` that owns the phase. The phase is genuinely shared by the views; the rest is not. Moving each field to its owner is what makes the module shrink.

**Alternative considered**: *Delete `state.ts` and move the phase into the `Session`.* Rejected: the phase is a view concern shared by many views; putting it on the session would make the session a view model. The slim module is the smaller, clearer seam.

## 3. The `Session` and the view's `cleared` event

**Decision**: Add `application/session.ts` with a `Session` that holds the `Clip` and the audio flag. Add a root `session.ts` that creates the single `Session` object. The `Clip` already announces `cleared`; each view subscribes and resets itself. The `Session` no longer imports view modules.

**Rationale**: The spec's "the view listens" story and the Domain model skill both say the view reacts to the model's announcement. The current `session.ts` is a registry of every view; replacing it with one event removes the registry and lets a new view reset itself without editing the session.

**Alternatives considered**:
- *Keep `session.ts` as the registry and add a `reset()` to each view.* Rejected: it keeps the coupling the story is trying to remove.
- *Move the reset into the `Clip`.* Rejected: the clip is domain and must not know the views.

## 4. The capture, recording and compositor ports

**Decision**: Define four ports in `application/ports/`:

- `CapturePort` — acquire and release the screen share; expose the video and audio tracks; report when the share ends.
- `WebcamPort` and `MicrophonePort` — acquire and release each device; expose the tracks.
- `TakeRecorderPort` — start and stop a `MediaRecorder`; return the recorded `Blob`.
- `CompositorPort` — draw the crop and the webcam bubble onto a canvas and mix the audio; return the stream the recorder consumes.
- `TakeProbePort` — measure a blob's duration without blocking the UI.
- `ClockPort` — `now()` and the timer used by the keep use case.

**Rationale**: These are the browser capabilities the recorder needs. A fake behind each port lets the record use case run in node. The compositor is separate because the crop canvas and the audio graph are browser work; the rule "a take needs a picture" stays in the domain.

**Alternative considered**: *One `RecorderPort` covering everything.* Rejected: a single port would hide which capability failed and make the fakes coarse. The smaller ports match the spec's "each browser capability sits behind a port".

## 5. The export use case and the frame renderer

**Decision**: Add `application/export-video.ts` as the use case. It takes an `ExportPlan`, an `EncoderPort`, a `DownloadPort` and a `FrameRendererPort`. The encoder adapter (`infra/offline-encoder.ts`) does the Mediabunny work and calls the injected frame renderer for the annotations and the preview. The view provides the renderer; the adapter imports no `ui/` module.

**Rationale**: `offline-export.ts` today imports `ui/dom.ts`, `ui/dissolve.ts` and `ui/annotation-layer.ts`. That is the boundary violation the spec names. Injecting the renderer keeps the encoder in `infra/` and the drawing in `ui/`, and it makes the encoder testable with a fake renderer.

**Alternatives considered**:
- *Move the annotation drawing into `infra/`.* Rejected: the annotation layer is a view concern; the glossary calls it the one place an annotation is drawn.
- *Keep the imports and accept the violation.* Rejected: the spec's whole point is to remove it.

## 6. The publish and keep/restore use cases

**Decision**: Keep `application/publish-to-bluesky.ts` and `application/bluesky-service.ts` as they are. Add `application/keep-clip.ts` and `application/restore-clip.ts` over a `KeptClipPort`; `infra/clip-store.ts` implements the port. The publish and export flows call the keep use case when the clip must survive a sign-in and the forget use case when the clip has been delivered.

**Rationale**: The publish use case is already port-based. The keep/restore logic is the part still in `resume.ts`; moving it behind a port lets the keep use case be tested with a fake store and keeps the IndexedDB adapter in `infra/`.

**Alternative considered**: *Leave `resume.ts` as a flow and only move its rules.* Rejected: the event subscription, the debounce and the snapshot are the use case; leaving them in the flow would keep the browser and the policy mixed.

## 7. The view flows

**Decision**: The flows that sequence browser work live in `ui/` as controllers: `record-flow.ts`, `export-flow.ts`, `publish-flow.ts`, `resume-flow.ts`, `review-flow.ts`. They call the use cases, update the phase and the status, and never make a rule. The composition root injects the adapters.

**Rationale**: The spec's "the flows only sequence" story. A flow needs the DOM and the adapters; it is a view controller. Putting it in `ui/` keeps `application/` pure and `infra/` free of policy.

**Alternative considered**: *A new `flows/` layer.* Rejected: the spec's clarification keeps the existing layers; a flow is a view controller.

## 8. Verification strategy

**Decision**: Follow the Verification skill's three levels.

- **Unit tests in node** for every new domain rule and every new use case. Fakes behind the ports. The old tests pass unmodified; if a test must change, the change is stated in the pull request.
- **Browser harness** for anything drawn, played or encoded: the phase-driven buttons, the source toggles and crop, the preview, the review, the export and the annotations, the resume after reload. A temporary `verify-*.html` on the dev server; the output pasted into the pull request; the file deleted before the commit.
- **Real session** for the screen share. The user runs it; the pull request says so.

**Rationale**: The constitution's principles III and IV, and the Verification skill. A passing build is not proof.

**Alternative considered**: *Rely on the build and the typechecker.* Rejected: the skill says a passing build proves only that the types line up.

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| The refactor changes behaviour while moving the recorder | The recorder goes last; each step is small; the old tests and a harness prove each step. |
| The `app` object's removal touches ~20 view modules | Steps 2–9 remove one field group at a time; each step is a separate pull request. |
| The screen share cannot be faked | The recorder step states the gap; the user runs a real share. |
| The encoder's preview import is easy to keep | The `FrameRendererPort` is the acceptance test; the encoder's imports are checked. |
| The old tests change | The pull request states any change and why; the constitution makes that a deliberate decision. |
| The version is bumped by hand | No step edits `package.json`; CI owns the version. |
