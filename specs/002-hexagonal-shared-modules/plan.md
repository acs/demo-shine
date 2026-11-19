# Implementation Plan: Hexagonal Shared Modules

**Branch**: `refactor/hexagonal-shared-modules` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-hexagonal-shared-modules/spec.md`

## Summary

Move the behaviour held by the seven root modules — `recorder.ts`, `exporter.ts`, `publisher.ts`, `session.ts`, `offline-export.ts`, `resume.ts`, `state.ts` — into the existing layers: pure rules in `domain/`, use cases and ports in `application/`, browser adapters in `infra/`, view flows in `ui/`, and the composition root in `main.ts`. The refactor is behaviour-preserving, ships as a sequence of pull requests, and is proved by the old tests passing unmodified, unit tests beside the new rules, and browser harnesses for anything drawn, played or encoded.

## Technical Context

**Language/Version**: TypeScript ^6.0.3, ES modules, strict.

**Primary Dependencies**: Vite ^8.3.8 (dev server and build), Vitest ^5.1.0 (node tests), Mediabunny ^1.66.0 (offline export), `@atproto/oauth-client-browser` ^0.5.14 (Bluesky sign-in). No UI framework.

**Storage**: IndexedDB for the clip snapshot (`src/infra/clip-store.ts`); in-memory `TakeRepository` for the object URLs; no server.

**Testing**: Vitest in node for `domain/` and `application/`; a temporary `verify-*.html` harness on the dev server for anything drawn, played or encoded; a real screen share for the recorder's flow, run by the user. The old tests are the refactor's proof and must pass unmodified.

**Target Platform**: Modern browsers. Screen capture via `getDisplayMedia`, recording via `MediaRecorder`, export via WebCodecs and Mediabunny (Chrome/Edge 94+, Firefox 130+), storage via IndexedDB. Installed as a PWA.

**Project Type**: Single-project browser application (SPA), no backend.

**Performance Goals**: Keep the current capture and export throughput. The offline export measured about 10× real time on a 6-second take; no visible slowdown is acceptable. Unit tests should stay fast enough to run on every change.

**Constraints**: No new runtime dependency. The seven named modules are the full scope. One step per pull request. CI owns the version; `package.json` is not bumped by hand. The screen-share flow cannot be faked and is stated as a gap. The words go into `GLOSSARY.md` before they appear in code.

**Scale/Scope**: About 30 source modules; the seven shared modules total roughly 1.5k lines. About 20 view modules read the shared `app` object. The refactor touches the whole `src/` tree but adds no feature and changes no user-visible behaviour.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status | Evidence |
|---|---|---|---|
| I. The skills are the constitution | The plan must not disagree with `.agents/skills/` or `GLOSSARY.md`; new words go in the glossary first | PASS | Step 1 updates the glossary and the skills before any code moves. The plan follows the Domain model and Verification skills. |
| II. `src/domain/` is pure | No DOM, no browser API, no import from `ui/` or `infra/`; a collaborator is a port | PASS | New domain objects (`CropRegion`, `SourceSet`) are pure. New ports live in `application/`; adapters in `infra/`; `domain/` imports neither. |
| III. Every rule has a test beside it | A rule in `domain/` is proved by a unit test in node; a refactor's proof is the old tests passing unmodified | PASS | New rules get unit tests beside them. The existing `Clip`, `ExportPlan`, `publish-to-bluesky` tests are the regression proof. |
| IV. What is drawn, played or encoded is proved in a browser | A temporary `verify-*.html` harness; the recorder's real share is the user's to run | PASS | Each step that changes a view, the preview, the recorder or the encoder names its harness. The screen-share gap is stated in every recorder step. |
| V. The words come first | A new concept is written into `GLOSSARY.md` before it appears in code | PASS | Step 1 is a docs-only change adding port, adapter, use case, view flow, phase, source set and crop region to the glossary. |
| VI. One change per pull request, and CI owns the version | A plan's step gets its own branch and pull request; `package.json` is never bumped by hand | PASS | The plan is a sequence of ten steps, each its own pull request. No step edits `package.json`. |

No violations. The Complexity Tracking table stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-hexagonal-shared-modules/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities and value objects
├── quickstart.md        # Phase 1 verification guide
├── contracts/
│   └── ports.md         # Phase 1 port contracts
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── spec.md              # Feature specification
```

### Source Code (target layout)

```text
src/
├── domain/
│   ├── clip/            # Span, SpanSet, TimelineMap, Take, TakeRepository, Clip, ExportPlan
│   ├── annotation/      # Annotation, AnnotationSet, kinds
│   ├── bluesky/         # AspectRatio, Bluesky value objects
│   ├── capture/         # CropRegion, SourceSet (new)
│   └── export/          # ExportTarget (new, moved from infra)
├── application/
│   ├── export-clip.ts   # plan an export (existing)
│   ├── publish-to-bluesky.ts  # publish use case (existing)
│   ├── bluesky-service.ts     # Bluesky port (existing)
│   ├── record-take.ts   # record use case (new)
│   ├── export-video.ts  # encode use case (new)
│   ├── keep-clip.ts     # keep use case (new)
│   ├── restore-clip.ts  # restore use case (new)
│   ├── session.ts       # Session: the clip and its audio (new)
│   └── ports/           # CapturePort, WebcamPort, MicrophonePort, TakeRecorderPort,
│                        # CompositorPort, TakeProbePort, ClockPort, EncoderPort,
│                        # DownloadPort, KeptClipPort, FrameRendererPort
├── infra/
│   ├── takes.ts         # InMemoryTakeRepository (existing)
│   ├── clip-store.ts    # IndexedDB clip store (existing)
│   ├── codecs.ts        # MediaRecorder MIME choice (existing)
│   ├── download.ts      # file download (existing)
│   ├── export-target.ts # codec choices (existing; the type moved to domain)
│   ├── bluesky.ts       # Bluesky adapter (existing)
│   ├── capture.ts       # screen, webcam and microphone adapters (new)
│   ├── compositor.ts    # crop canvas and audio mixer (new)
│   ├── take-recorder.ts # MediaRecorder adapter (new)
│   ├── take-probe.ts    # duration probe (new)
│   ├── offline-encoder.ts # moved from offline-export.ts
│   └── clock.ts         # time and timers (new)
├── ui/
│   ├── ...existing views and widgets...
│   ├── record-flow.ts   # recorder view flow (new)
│   ├── export-flow.ts   # export view flow (new)
│   ├── publish-flow.ts  # publish view flow (new)
│   ├── resume-flow.ts   # resume view flow (new)
│   └── review-flow.ts   # opens the review (new)
├── state.ts             # the phase only (reduced)
├── session.ts           # composition: the session object (reduced)
└── main.ts              # composition root
```

**Structure Decision**: Keep the existing four layers and the existing layer names. No new top-level folder. A port lives beside the use case that needs it; an adapter lives in `infra/`; a view flow lives in `ui/`; the composition root wires them. The seven root modules are removed or reduced to `state.ts` (the phase) and `session.ts` (the session object); `main.ts` stays the composition root. `offline-export.ts` moves to `infra/offline-encoder.ts`.

## Implementation Sequence

Each step is its own branch and pull request. A step leaves the app working and its tests green. The order moves the safest seams first and the recorder last, because the recorder needs a real screen share.

| Step | Change | Proof | Pull request |
|---|---|---|---|
| 1 | **Words and map.** Add the new words to `GLOSSARY.md`; update the Overview and Domain model skills with the target layout. No code. | Docs review; the glossary is the only source of the words. | `docs/hexagonal-words` |
| 2 | **Phase leaves `state.ts`.** `state.ts` keeps only `Phase`, `setPhase`, `onPhaseChange` and `currentPhase`. Remove `app.phase`; update every reader. | A unit test for the phase watchers; typecheck; a browser harness for the phase-driven buttons. | `refactor/phase-module` |
| 3 | **The session owns the clip; the view listens.** Add `application/session.ts` and the root `session.ts` composition. Remove `app.clip`; views subscribe to `clip.onChange` and reset on `cleared`. Remove the view imports from `session.ts`. | Old tests; a browser harness that clears the clip and checks every view resets. | `refactor/session-clip` |
| 4 | **Source set and crop region.** Add `domain/capture/CropRegion.ts` and `SourceSet.ts`; update the region, source-button and preview views. Remove `app.region`, `app.screenOn`, `app.webcamOn`, `app.micOn`, `app.captureW`, `app.captureH`. | Unit tests for both value objects; a browser harness for the source toggles and the crop box. | `refactor/source-crop` |
| 5 | **Capture adapters.** Add `infra/capture.ts` and the three capture ports. Move the screen, webcam and microphone acquisition out of the views. Remove `app.stream`, `app.webcamStream`, `app.micStream`. | Unit tests for the source flow with fakes; a browser harness for the toggles; a real share for the screen path. | `refactor/capture-adapters` |
| 6 | **Record use case and adapters.** Add `application/record-take.ts`, `infra/compositor.ts`, `infra/take-recorder.ts`, `infra/take-probe.ts`, `infra/clock.ts`, `ui/record-flow.ts` and `ui/review-flow.ts`. Remove `recorder.ts` and the remaining `app` fields it owns. | Unit tests for the record use case with fakes; a browser harness for the preview and the review; a real share for the capture. | `refactor/record-use-case` |
| 7 | **Export use case and encoder.** Add `application/export-video.ts`, `infra/offline-encoder.ts` and `FrameRendererPort`; add `ui/export-flow.ts`. Remove `exporter.ts` and `offline-export.ts`. | The existing `ExportPlan` and `export-clip` tests; a browser harness for the export and the annotations; a real file export. | `refactor/export-use-case` |
| 8 | **Publish and keep/restore.** Add `application/keep-clip.ts`, `restore-clip.ts`, `KeptClipPort`, `ui/publish-flow.ts` and `ui/resume-flow.ts`. Remove `publisher.ts` and `resume.ts`; the clip store implements the port. | The existing `publish-to-bluesky` tests; new keep/restore tests with a fake store; a browser harness for resume after reload. | `refactor/publish-keep` |
| 9 | **Remove the shared `app` object.** The remaining fields are owned by views or adapters; `state.ts` is the phase only. | Typecheck; old tests; a browser harness for the whole flow. | `refactor/state-phase-only` |
| 10 | **Final verification and docs.** Run the full suite; a browser harness for the end-to-end flow; a real session; update the README module map. | The three levels of the Verification skill; the old tests unmodified. | `refactor/hexagonal-final` |

## Complexity Tracking

No constitution violations. The refactor adds no layer, no dependency and no user-visible behaviour. The only complexity is the number of steps; the sequence keeps each one small and independently reviewable.

## Post-Design Constitution Check

Re-checked after the Phase 1 design artifacts were written.

| Principle | Result | Evidence |
|---|---|---|
| I. The skills are the constitution | PASS | The plan follows the Domain model and Verification skills. Step 1 updates the skills and the glossary before the code moves. |
| II. `src/domain/` is pure | PASS | `CropRegion` and `SourceSet` are pure; the ports live in `application/`; the adapters in `infra/`; the dependency rule in `contracts/ports.md` keeps `domain/` clean. |
| III. Every rule has a test beside it | PASS | `data-model.md` names the new tests; `quickstart.md` runs them; the old tests are the regression proof. |
| IV. What is drawn, played or encoded is proved in a browser | PASS | `quickstart.md` names the harnesses for the phase, the source and crop, the export and annotations, and resume; the real share is stated as a gap. |
| V. The words come first | PASS | Step 1 is a docs-only change; the glossary and the skills are updated before any code moves. |
| VI. One change per pull request, and CI owns the version | PASS | The plan has ten steps, each its own branch and pull request; no step edits `package.json`. |

No new violations. The design is ready for `/speckit.tasks`.

