# Quickstart — Verifying Automated End-to-End Tests

How to run the layer, and what each check is worth. The rules are in the
[Verification skill](../../.agents/skills/verification/SKILL.md); the requirements are
in [spec.md](./spec.md); the helpers are in
[contracts/e2e-support.md](./contracts/e2e-support.md).

## Prerequisites

- Node 22 (`node -v`).
- `npm ci`.
- A Chromium for Playwright: `npx playwright install chromium`. On this machine the
  browsers are already cached under `~/Library/Caches/ms-playwright`, so nothing is
  downloaded; CI installs chromium with `--with-deps`.

## Commands

| Command | What it runs |
|---|---|
| `npm test` | the node unit suite only — **unchanged** (FR-012) |
| `npm run test:e2e` | the end-to-end suite in a headless Chromium |
| `npx playwright test e2e/checks/cutting.spec.ts` | one check while iterating |
| `npx playwright test --trace on` | with a trace for every check |
| `npm run lint && npm run typecheck && npm run build` | the rest of the gate |

The dev server is started for you by Playwright's `webServer`; you do not start it
by hand (set `reuseExistingServer` behaviour by running with or without `CI`).

## Scenarios, and what each proves

### 1. The app boots

- **Run**: `npx playwright test e2e/checks/smoke.spec.ts`
- **Expect**: the status chip reads **Ready**, and the app made no network request.
- **Worth**: the runner, the webServer and the boot helper are wired (FR-001).

### 2. A clip is built without recording

- **Run**: `npx playwright test e2e/checks/timeline.spec.ts`
- **Expect**: a two-take clip seeded from fixtures shows a strip of distinct cells,
  and the clip's length is the sum of the takes.
- **Worth**: fixtures are real, decodable WebM the app's own probe and strip read
  unchanged, and they build in milliseconds (FR-006, FR-007, FR-009).

### 3. The four regressions are caught

For each of the four, run the check against the commit **before** its fix and against
the fixed code:

| Regression | `beforeCommit` (the parent of the fix) | The check |
|---|---|---|
| capture sized from the picture, not a track's settings | `e33e157`'s parent | `capture.spec.ts` |
| cursor, frame rate and pane asked for | `fc582a4`'s parent | `capture.spec.ts` |
| a silent share reported | `416c79b`'s parent | `capture.spec.ts` |
| the compositor at the picture's size | `c7e00b8`'s parent | `capture.spec.ts` |

- **Run**: `git checkout <beforeCommit> -- . && npx playwright test e2e/checks/capture.spec.ts`
  (or check the commit out in a worktree), then run again on the fixed code.
- **Expect**: **fails** before, **passes** after. Both outputs go in the pull request.
- **Worth**: the story the feature exists for (FR-004, FR-005, SC-001).

### 4. Cutting and undo

- **Run**: `npx playwright test e2e/checks/cutting.spec.ts`
- **Expect**: clicking the timeline marks a section; the scissors turns it into a
  cut; the chip's text and the undo button appear; undo restores the length.
- **Worth**: the cutting flow a person sees, asserted on the chip and the button, not
  only on the model (FR-016).

### 5. Annotations

- **Run**: `npx playwright test e2e/checks/annotations.spec.ts`
- **Expect**: an arrow, an image and a text annotation can each be placed, moved,
  resized, copied, pasted and deleted through the real canvas.
- **Worth**: the shared editing behaviour of every kind.

### 6. Export carries a duration and cues

- **Run**: `npx playwright test e2e/checks/export.spec.ts`
- **Expect**: exporting WebM and MP4 downloads a file that decodes with the right
  duration and cue points — the facts a `MediaRecorder` file does not carry.
- **Caveat**: headless numbers are headless numbers; the check asserts the file's
  shape, not its perceived quality (FR-003).

### 7. Keep and restore across a reload

- **Run**: `npx playwright test e2e/checks/keeping.spec.ts`
- **Expect**: after a reload, the clip comes back into the review with its takes and
  cuts.
- **Worth**: IndexedDB keeping, and the reload path the service worker must not
  shadow (FR-003).

### 8. The record flow on stand-in devices

- **Run**: `npx playwright test e2e/checks/capture.spec.ts`
- **Expect**: with the fake camera and mic, turning Webcam on and recording produces a
  take; the capture's handling of a handed-back share asks for the cursor, frame rate
  and pane.
- **Gap, stated**: the **share picker itself** is not opened — `getDisplayMedia` needs
  a gesture and a pane — so a change touching the record flow still asks the user to
  run a real session (FR-010, FR-011).

### 9. The publish dialog, network stood in for

- **Run**: `npx playwright test e2e/checks/publishing.spec.ts`
- **Expect**: the sign-in, compose and error states render, and the request the app
  builds is asserted — with no live round-trip.
- **Gap, stated**: a real sign-in is the person's check.

### 10. A check that cannot run is skipped, not passed

- **Run**: force the environment to lack a capability (for example, disable the codec
  the export check needs).
- **Expect**: the check reports **skipped** with a stated reason, and the run does not
  read as a pass (FR-014).

## What this layer does not prove

- The screen-share **picker**, real audio heard through speakers, real device variety,
  and a live Bluesky sign-in round-trip — all the person's checks (FR-010, FR-011).
- The rules in `src/domain/` — those stay the node unit suite's job (FR-012).
- More than one browser engine — Chromium only, for now (R10).

## The whole gate, before pushing

```bash
npm run lint && npm run typecheck && npx vitest run && npm run test:e2e && npm run build
```
