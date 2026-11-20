# Implementation Plan: Webcam Picker

**Branch**: `001-select-webcam-picker` | **Date**: 2026-11-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature description: "add picker to select the webcam if there are several available (mobile phone has 2)"

**Note**: This plan follows the repository's conventions: a rule in `src/domain/` gets a unit test in node, anything drawn or wired to the DOM gets a browser harness, and the recorder's flow is verified in a real session.

## Summary

Add a camera picker to the webcam controls. When the webcam is on and more than one video input device is present, a small caret beside the webcam toggle opens a popover menu — styled and placed like the Export menu — listing the cameras. The device's default camera is active first; choosing another switches the live stream. The caret is hidden for zero or one camera and disabled while a take is starting or recording. The selection lives in memory for the page; it is not persisted. No new dependencies.

## Technical Context

**Language/Version**: TypeScript 6 (ES modules), Vite 8, Vitest 5

**Primary Dependencies**: none new; browser `navigator.mediaDevices` — `enumerateDevices()`, `getUserMedia()`, `devicechange`

**Storage**: none — the selection is in memory for the page; no `localStorage`, no IndexedDB

**Testing**: Vitest (node) for the pure camera-list helpers; a browser harness on the dev server for the picker's DOM behaviour; a real session for the actual camera switch (no harness can grant a camera)

**Target Platform**: modern browsers — desktop Chrome/Firefox/Safari/Edge and mobile Safari/Chrome; the app is a pure browser SPA

**Project Type**: single-page web app (Vite), no server

**Performance Goals**: switching cameras updates the preview within 2 seconds (SC-002); the picker appears with the webcam start and adds no measurable overhead

**Constraints**: no new dependencies; keep the source-button pattern (`ui/source-buttons.ts`); the picker must not touch the clip or the session; no persistence; the webcam remains the user's own toggle; the picker is disabled while a take owns the sources

**Scale/Scope**: one small UI change — `ui/webcam.ts`, `ui/dom.ts`, `ui/source-buttons.ts`, `main.ts`, `index.html`, `styles.css` — plus a pure helper module and its test; about one screen of interface

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution at `.specify/memory/constitution.md` is an unfilled template: every principle and section is a placeholder. No project-specific principles, gates, or governance rules are defined. Therefore no gate applies. The plan follows the repository's own conventions instead:

- A rule in `src/domain/` gets a unit test beside it. This change has no domain rule; the camera list is a view concern.
- Anything drawn or wired to the DOM gets a browser harness. The picker gets `verify-camera-picker.html` during development, deleted before commit.
- The recorder's flow (a real camera) is verified in a real session. The camera switch is part of that flow.

**Result**: PASS — no constitution defined; repo conventions applied.

**Post-design re-check**: PASS — the design introduces no domain rule, no new dependency, no storage, and no new directory; the same conventions apply.

## Project Structure

### Documentation (this feature)

```text
specs/001-select-webcam-picker/
├── plan.md              # this file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── camera-picker.md # the picker's UI contract
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── ui/
│   └── recording/
│       ├── webcam.ts          # owns the webcam source: enumerate, start, switch, devicechange
│       ├── camera-list.ts     # pure helpers: labels, duplicates, should-show
│       ├── camera-list.test.ts# unit test for the helpers
│       ├── camera-menu.ts     # the popover: open, place, close, pick
│       └── source-buttons.ts  # disables the caret while a take owns the sources
├── ui/dom.ts                  # registers #cam-pick-btn and #cam-menu
├── infra/capture.ts           # startWebcam(deviceId), switchWebcam(deviceId)
├── application/ports/WebcamPort.ts  # the port gains an optional deviceId
└── main.ts                    # wires the caret and the menu

index.html                     # the caret beside #webcam-btn and the menu at the body
styles.css                     # .cam-pick-btn, .cam-menu, .cam-item
```

**Structure Decision**: Single Vite app, no new directories. The picker belongs to the webcam source, so it lives in `ui/webcam.ts`; its element is registered in `ui/dom.ts`; its change event is wired in `main.ts` like the webcam button; its pure list rules live in `ui/camera-list.ts` with a node test. The CSS goes in `styles.css` beside the source-button rules.

## Complexity Tracking

> No constitution violations. The change is small and follows the existing source-button pattern; no additional projects, layers, or dependencies are introduced.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
