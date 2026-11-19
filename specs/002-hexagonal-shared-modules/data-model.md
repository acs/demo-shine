# Data Model: Hexagonal Shared Modules

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

This document lists the model the refactor owns. It does not repeat the existing domain classes; it names what is new, what moves, and what stays. The clip's rules remain in `Clip`; the refactor does not change them.

## Domain

### Existing, unchanged

| Entity | File | Responsibility |
|---|---|---|
| `Clip` | `src/domain/clip/Clip.ts` | The aggregate: takes, cuts, annotations, the one undo, the `cleared` event. |
| `Take` | `src/domain/clip/Take.ts` | One press of Record; a blob with a duration. |
| `Span`, `SpanSet`, `TimelineMap` | `src/domain/clip/` | Ranges, sets of ranges, the recording-to-output map. |
| `ExportPlan` | `src/domain/clip/ExportPlan.ts` | What an export encodes: the kept pieces, the joins, the settings. |
| `Annotation`, `AnnotationSet` | `src/domain/annotation/` | What is drawn over the picture. |
| `AspectRatio`, Bluesky value objects | `src/domain/bluesky/` | The publish rules. |

### New

| Entity | File | Fields | Rules |
|---|---|---|---|
| `CropRegion` | `src/domain/capture/CropRegion.ts` | `x`, `y`, `w`, `h`, normalised to 0..1 | A region is inside the picture; `FULL` is the whole picture; a region is never empty. |
| `SourceSet` | `src/domain/capture/SourceSet.ts` | `screen`, `webcam`, `mic` | A take needs a picture: screen or webcam. The three toggles are independent. A source is on only when its device is held. |

`CropRegion` and `SourceSet` are pure classes. They have unit tests beside them. `SourceSet` replaces the booleans in `state.ts`; `CropRegion` replaces the `Rect` interface and the `region` field.

### Moved types

| Type | From | To | Why |
|---|---|---|---|
| `ExportTarget` | `src/infra/export-target.ts` | `src/domain/export/ExportTarget.ts` | The `EncoderPort` needs to name the container without importing `infra/`. The codec choices stay in `infra/export-target.ts`. |
| `Rect` | `src/state.ts` | replaced by `CropRegion` | The crop is a rule, not a view type. |

## Application

### New use cases

| Use case | File | Input | Output | Ports |
|---|---|---|---|---|
| `RecordTake` | `src/application/record-take.ts` | `SourceSet`, `CropRegion`, the `Clip` | `RecordOutcome`: started, stopped with a `Take`, or refused with a reason | `CapturePort`, `WebcamPort`, `MicrophonePort`, `TakeRecorderPort`, `CompositorPort`, `TakeProbePort`, `ClockPort` |
| `ExportVideo` | `src/application/export-video.ts` | `ExportPlan`, `ExportSettings` | `ExportOutcome`: a blob and stats, or a refusal | `EncoderPort`, `DownloadPort`, `FrameRendererPort` |
| `KeepClip` | `src/application/keep-clip.ts` | `Clip`, the audio flag | `KeepOutcome`: saved or failed | `KeptClipPort`, `ClockPort` |
| `RestoreClip` | `src/application/restore-clip.ts` | none | `RestoreOutcome`: a `ClipSnapshot` and audio, or nothing | `KeptClipPort` |

`ExportVideo` reuses the existing `planExport` in `src/application/export-clip.ts`. The `KeepClip` use case owns the event subscription and the debounce; the `RestoreClip` use case owns the snapshot load. The publish use case stays in `src/application/publish-to-bluesky.ts`; it gains the keep/forget calls through its ports.

### New ports

| Port | File | Implemented by |
|---|---|---|
| `CapturePort` | `src/application/ports/CapturePort.ts` | `src/infra/capture.ts` |
| `WebcamPort` | `src/application/ports/WebcamPort.ts` | `src/infra/capture.ts` |
| `MicrophonePort` | `src/application/ports/MicrophonePort.ts` | `src/infra/capture.ts` |
| `TakeRecorderPort` | `src/application/ports/TakeRecorderPort.ts` | `src/infra/take-recorder.ts` |
| `CompositorPort` | `src/application/ports/CompositorPort.ts` | `src/infra/compositor.ts` |
| `TakeProbePort` | `src/application/ports/TakeProbePort.ts` | `src/infra/take-probe.ts` |
| `ClockPort` | `src/application/ports/ClockPort.ts` | `src/infra/clock.ts` |
| `EncoderPort` | `src/application/ports/EncoderPort.ts` | `src/infra/offline-encoder.ts` |
| `DownloadPort` | `src/application/ports/DownloadPort.ts` | `src/infra/download.ts` |
| `FrameRendererPort` | `src/application/ports/FrameRendererPort.ts` | `src/ui/annotation-layer.ts` and `src/ui/dissolve.ts` |
| `KeptClipPort` | `src/application/ports/KeptClipPort.ts` | `src/infra/clip-store.ts` |

The port signatures are in [contracts/ports.md](./contracts/ports.md).

### The `Session`

`src/application/session.ts`:

| Field | Type | Notes |
|---|---|---|
| `clip` | `Clip` | The aggregate. |
| `audio` | `boolean` | Did the last take capture audio? |
| `end()` | method | Clears the clip; the views hear `cleared`. |

The root `src/session.ts` creates the single `Session` and exports it. The `Session` imports no view module.

## Infrastructure

| Adapter | File | Port | Notes |
|---|---|---|---|
| Capture | `src/infra/capture.ts` | `CapturePort`, `WebcamPort`, `MicrophonePort` | `getDisplayMedia`, `getUserMedia`; owns the tracks and the release. |
| Compositor | `src/infra/compositor.ts` | `CompositorPort` | The crop canvas and the audio mixer; the `Output` and `Mixer` classes move here. |
| Take recorder | `src/infra/take-recorder.ts` | `TakeRecorderPort` | `MediaRecorder`; owns the chunks and the blob. |
| Take probe | `src/infra/take-probe.ts` | `TakeProbePort` | The `measureTake` and `resolveVideoDuration` logic moves here. |
| Clock | `src/infra/clock.ts` | `ClockPort` | `performance.now`, `setTimeout`. |
| Offline encoder | `src/infra/offline-encoder.ts` | `EncoderPort` | Moved from `offline-export.ts`; Mediabunny; calls the frame renderer. |
| Clip store | `src/infra/clip-store.ts` | `KeptClipPort` | Existing IndexedDB adapter; implements the port. |
| Bluesky | `src/infra/bluesky.ts` | `BlueskyService` | Existing; lazy-loaded by the publish flow. |

## View flows

| Flow | File | Responsibility |
|---|---|---|
| Record | `src/ui/record-flow.ts` | Wires the source buttons, the record button, the preview and the phase; calls `RecordTake`. |
| Review | `src/ui/review-flow.ts` | Opens the review after a take or a restore; calls the player and the timeline. |
| Export | `src/ui/export-flow.ts` | Wires the export button; calls `ExportVideo`; updates the status. |
| Publish | `src/ui/publish-flow.ts` | Wires the publish button; calls the publish use case; handles the sign-in. |
| Resume | `src/ui/resume-flow.ts` | Calls `RestoreClip` at startup; opens the review. |

## State transitions

### Phase

```
idle → starting → live → recording → review → encoding → review
  ↑                                                    |
  └──────────────────── New / share lost ───────────────┘
```

The phase stays in `state.ts`. The transitions are the view flows' business; the phase is the only shared state.

### Clip events

The existing `ClipEvent` stays:

- `take-added` — a take was appended; the view re-bases what it shows.
- `cleared` — the session is over; each view resets itself.
- `cut-approved`, `cut-removed`, `annotation-added`, `annotation-changed`, `annotation-removed` — the existing events.

The refactor adds no event. The view's `cleared` listener is the new use of the existing event.

## Persistence

The `ClipSnapshot` and `StoredClip` shapes do not change. The `KeptClipPort` wraps the existing `clip-store.ts` functions; the IndexedDB schema stays the same. The keep use case debounces metadata writes with the `ClockPort`; the restore use case reads the snapshot and calls `Clip.restore`.

## What does not change

- The clip's rules and its tests.
- The export plan and its tests.
- The publish use case and its tests.
- The IndexedDB schema and the clip snapshot.
- The user-visible behaviour.
