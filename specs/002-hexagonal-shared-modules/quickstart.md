# Quickstart: Hexagonal Shared Modules

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Contracts**: [contracts/ports.md](./contracts/ports.md)

This is the validation guide for the refactor. It follows the Verification skill's three levels: unit tests in node, a browser harness on the dev server, and a real session for the screen share. A passing build is not proof.

## Prerequisites

```sh
npm install
npm run dev          # http://127.0.0.1:5173
```

## 1. The full check before every step

```sh
npm run lint && npm run typecheck && npx vitest run && npm run build
```

`npm run typecheck` is `tsc --noEmit`; `npm run build` runs the typecheck and the Vite build. A step is not finished until this passes.

## 2. Unit tests in node

The new domain rules and the new use cases are proved here. The old tests must pass unmodified.

```sh
npx vitest run src/domain src/application
```

What to look for:

- `src/domain/capture/CropRegion.test.ts` — a region stays inside the picture; `FULL` is the whole picture; an empty region is refused.
- `src/domain/capture/SourceSet.test.ts` — a take needs a picture; the three toggles are independent.
- `src/application/record-take.test.ts` — a take starts and stops with fakes; a refused take has a reason; the clip receives the take.
- `src/application/export-video.test.ts` — the plan is encoded with a fake encoder; the outcome carries the blob and the stats; a missing encoder is refused.
- `src/application/keep-clip.test.ts` — a take is saved as it arrives; metadata is debounced; the clip is saved before a sign-in.
- `src/application/restore-clip.test.ts` — a stored clip is restored; nothing is restored when the store is empty.
- The existing `Clip`, `Span`, `SpanSet`, `TimelineMap`, `ExportPlan`, `publish-to-bluesky` and `bluesky` tests pass without edits.

If an old test had to change, the pull request says which test and why. The constitution makes that a deliberate decision.

## 3. Browser harness

Anything drawn, played or encoded is proved on the running dev server. Write a temporary `verify-<what>.html` in the repository root, open it on the dev server, read the output, paste it into the pull request, and delete the file before the commit.

### Harness: phase and views

1. Open the app. The phase starts at `idle`; the record button is disabled until a source is on.
2. Turn the screen on; the phase moves to `live`; the preview shows the share.
3. Start and stop a take; the phase moves to `review`; the review opens.
4. Export; the phase moves to `encoding` and back to `review`.
5. Clear the clip; every view resets — the timeline, the marks, the annotation lane, the player and the preview — without a reload.

### Harness: source and crop

1. Toggle the screen, the webcam and the microphone independently; each toggle changes only its own source.
2. The crop box stays inside the picture; a full crop is the default.
3. The preview shows the source that is live; the record button is enabled only when a picture source is on.

### Harness: export and annotations

1. Build a clip with a take and an annotation.
2. Export to a file. The file downloads; the annotation appears at the same moment and over the same part of the picture as in the review.
3. Export with a cut; the kept part only is encoded; the join dissolves as in the review.
4. The preview shows the frames as they are encoded.

### Harness: resume

1. Record a take and reload the page. The clip comes back; the review opens; the take plays.
2. Reload with no clip; the app starts empty and the resume flow does nothing.
3. Clear the clip; reload; nothing comes back.

## 4. Real session

The screen share cannot be faked. The user runs this and the pull request says so.

1. Start the dev server.
2. Turn the screen on; accept the browser's share prompt.
3. Record a take; stop it; the review opens and the take plays.
4. Turn the screen off; the share is released; the preview falls back to the webcam when it is on.
5. Stop sharing from the browser's own UI; the app notices and the phase returns to `review`.

Do not claim a real share was run unless it was. The recorder's step is the only one that needs this level.

## 5. Step-by-step order

Follow the plan's sequence. Each step is its own branch and pull request. The order is chosen so the app works after every step.

| Step | Branch | What to run |
|---|---|---|
| 1 | `docs/hexagonal-words` | Docs review; no code. |
| 2 | `refactor/phase-module` | Unit tests for the phase; the phase harness. |
| 3 | `refactor/session-clip` | Old tests; the phase and view harness. |
| 4 | `refactor/source-crop` | `CropRegion` and `SourceSet` unit tests; the source and crop harness. |
| 5 | `refactor/capture-adapters` | Source-flow tests with fakes; the source and crop harness; a real share. |
| 6 | `refactor/record-use-case` | `RecordTake` tests; the preview and review harness; a real share. |
| 7 | `refactor/export-use-case` | `ExportVideo` tests; the export and annotation harness; a real file export. |
| 8 | `refactor/publish-keep` | Keep/restore tests; the resume harness; a real publish if the user runs it. |
| 9 | `refactor/state-phase-only` | Typecheck; old tests; the full harness. |
| 10 | `refactor/hexagonal-final` | The full check; the end-to-end harness; a real session. |

## 6. What not to do

- Do not bump `package.json`; CI owns the version.
- Do not commit a `verify-*.html` file.
- Do not change an old test without saying so in the pull request.
- Do not claim a browser harness or a real share was run when it was not.
- Do not add a new runtime dependency for the refactor.
