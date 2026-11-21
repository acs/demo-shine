# Implementation Plan: Automated End-to-End Tests

**Branch**: `chore/e2e-testing` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-e2e-testing/spec.md`

## Summary

Add a committed, automated end-to-end layer that drives the real DemoClip app in a real browser on every pull request. **Playwright Test** navigates the app's own page (`web/index.html`) on the dev server; a shared **boot helper** seeds state through the app's own modules — the mechanism the throwaway harnesses already use — with **no change to the application**; deterministic **fixture takes** are encoded in milliseconds with WebCodecs and Mediabunny (the app's own export path), so the timeline, cutting, annotations, export and keeping are proved **without recording**. The four regressions that shipped by hand get a **regression check** each, proved to fail before its fix and pass after. The layer ships as a single pull request, **replaces the temporary `verify-*.html` practice**, and leaves the node unit suite untouched.

## Technical Context

**Language/Version**: TypeScript ^6.0.3, ES modules, strict. Node 22 in CI.

**Primary Dependencies**: existing — Vite ^8.3.8 (dev server), Vitest ^5.1.0 (node tests), Mediabunny ^1.66.0 (fixture encoding and export), `@atproto/oauth-client-browser` ^0.5.14. **New, development-only**: `@playwright/test` (latest 1.x). Chromium, Firefox and WebKit are already cached under `~/Library/Caches/ms-playwright` on the developer machine; CI installs chromium only.

**Storage**: IndexedDB — the `democlip` database in `src/infra/clip-store.ts` — is the state the suite must clear between checks, so check order cannot change a result. No server, and no network in any check (the publishing service is stood in for).

**Testing**: This feature *is* the testing layer. Playwright Test (`e2e/**/*.spec.ts`) drives the real app on the dev server; fixture takes come from WebCodecs + Mediabunny; the node unit suite (Vitest, `src/**/*.test.ts`) is unchanged and remains the proof for `src/domain/`.

**Target Platform**: Headless Chromium — CI: `ubuntu-latest`; local: the developer's machine. The app still targets modern browsers; the suite covers one engine first, by decision.

**Project Type**: Single-project browser application (SPA), no backend.

**Performance Goals**: The suite's check on a pull request completes in **under 5 minutes**, the browser install included (SC-004). A fixture take is produced in milliseconds, never in real time.

**Constraints**: No runtime dependency — anything the suite needs is development-only. One change per pull request. CI owns the version: `package.json`'s `version` is never bumped by hand (adding a devDependency is not a version bump). The verification rules are amended in their own change. `src/domain/` stays pure and is not touched. The screen-share picker cannot be driven and is stated as a gap in every change that touches the record flow.

**Scale/Scope**: Two runners; a new top-level `e2e/` directory; roughly a dozen checks at first. Touches `package.json` / `package-lock.json` (devDependencies), `.gitignore`, `.github/workflows/ci.yml`, `playwright.config.ts`, `e2e/`, `GLOSSARY.md`, `README.md` and `.agents/skills/verification/SKILL.md`. **No `src/` file changes.**

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status | Evidence |
|---|---|---|---|
| I. The skills are the constitution | The plan must not disagree with `.agents/skills/` or `GLOSSARY.md`; new words go in the glossary first | PASS | Step 1 adds **fixture take**, **boot helper**, **regression check**, **suite run**, **evidence artifact** and **stand-in share** to `GLOSSARY.md` and amends the Verification skill, before any code moves. |
| II. `src/domain/` is pure | No DOM, no browser API, no import from `ui/` or `infra/`; a collaborator is a port | PASS | The suite lives in `e2e/`, outside `src/`, and changes no domain module. It reaches the app through the dev server's own module URLs, as a browser does. |
| III. Every rule has a test beside it | A rule in `src/domain/` is proved by a unit test in node; a refactor's proof is the old tests passing unmodified | PASS | No domain rule is added or changed. The node unit suite is unchanged and continues to run in node (FR-012, SC-005). |
| IV. What is drawn, played or encoded is proved in a browser | A temporary `verify-*.html` harness; the recorder's real share is the user's to run | PASS, by amendment | This feature **amends** Principle IV in its own change (Step 1): the browser proof becomes a committed check in the suite, the harness is retired, and the record flow's real share stays the person's (FR-020, FR-020a). The amendment is the step, not a quiet divergence. |
| V. The words come first | A new concept is written into `GLOSSARY.md` before it appears in code | PASS | Step 1 is a docs-only change; every new word is in the glossary before Step 2 writes it into `e2e/`. |
| VI. One change per pull request, and CI owns the version | A plan's step gets its own branch and pull request; `package.json` is never bumped by hand | PASS | The plan is a sequence of seven steps, each its own branch and pull request. No step edits `package.json`'s `version`. |

No violations. The Complexity Tracking table stays empty. The one deliberate departure — amending Principle IV rather than obeying it — is the feature itself, done through the governance path the constitution names (amend the skill, in its own change).

## Project Structure

### Documentation (this feature)

```text
specs/005-e2e-testing/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities and value objects
├── quickstart.md        # Phase 1 verification guide
├── contracts/
│   └── e2e-support.md   # Phase 1 test-support contract
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── spec.md              # Feature specification
```

### Source Code (repository root)

```text
e2e/                              # NEW — the end-to-end layer, outside src/
├── fixtures/
│   └── takes.ts                  # deterministic WebM takes, WebCodecs + Mediabunny
├── helpers/
│   └── app.ts                    # boot helper: load the app, wait ready, seed the clip
├── checks/
│   ├── smoke.spec.ts             # the app boots and reads Ready
│   ├── capture.spec.ts           # the four regression checks (stand-in share, stand-in devices)
│   ├── timeline.spec.ts          # strip, waveform, marks
│   ├── cutting.spec.ts           # marks → section → scissors → cut → undo
│   ├── annotations.spec.ts       # arrow, image, text
│   ├── export.spec.ts            # WebM and MP4 carry a duration and cues
│   ├── keeping.spec.ts           # keep and restore across a reload
│   └── publishing.spec.ts        # publish dialog states, network stood in for
└── playwright.config.ts          # the runner config and the webServer

.github/workflows/ci.yml          # gains an `e2e` job beside `quality`
package.json                      # gains the `test:e2e` script and the devDependency
package-lock.json                 # the lockfile follows
.gitignore                        # gains playwright-report/ and test-results/

# untouched: src/ (no application change), vitest.config.ts, the unit suite
```

**Structure Decision**: Keep the suite in a new top-level `e2e/` directory, separate from `src/`. Vitest's `include` is `src/**/*.test.ts`, so `e2e/**/*.spec.ts` can never be picked up by the unit runner, and the unit suite is provably unchanged. The application itself is not modified: a check reaches the app's own modules through `e2e/support/app-hooks.ts`, served at `/@fs/<repo-root>/e2e/support/app-hooks.ts` (the Vite root is `web/`), whose relative imports resolve to the app's module URLs, so the suite needs no test hook and adds no runtime code.

## Implementation Sequence

Each step is its own branch and pull request, leaves the app working, and keeps both
suites green — **except this feature, which ships as one pull request**
(`chore/e2e-testing`) at the maintainer's request; the steps are then the commits
inside it, in order. The safest seams come first: words and rules, then the runner,
then the fixtures the editing checks need, then the regressions, then the flows.

| Step | Change | Proof | Pull request |
|---|---|---|---|
| 1 | **Words and rules.** Add the new words to `GLOSSARY.md`; amend the Verification skill so a browser-facing behaviour is proved by a committed check and the `verify-*.html` harness is retired (the record flow's real share stays the person's). No code. | Docs review; the glossary is the only source of the words. | `docs/e2e-words` |
| 2 | **Foundation.** Add `@playwright/test`, `e2e/playwright.config.ts` (webServer on the dev server), the `test:e2e` script, the `.gitignore` lines and the CI `e2e` job. One smoke check: the app boots and the status chip reads Ready. | The smoke check passes locally and in CI; `npm test` still runs only the node suite. | `chore/e2e-foundation` |
| 3 | **Fixture takes and the boot helper.** `e2e/fixtures/takes.ts` (a WebM with an exact duration, video, optionally audio) and `e2e/helpers/app.ts` (navigate, wait ready, seed the clip). The first real check builds a two-take clip and asserts the strip drew distinct cells and the length is the sum of the takes. | The check runs in milliseconds; the app's own `take-probe` and strip decode the fixture unchanged. | `feat/e2e-fixtures` |
| 4 | **Regression corpus.** One check per named regression — the capture sized from the picture; the cursor, frame rate and pane asked for; a silent share reported; the compositor at the picture's size — each proved to fail on the commit before its fix and pass after. | The four fail-before / pass-after pairs, pasted into each pull request (FR-005). | `fix/e2e-regression-corpus` |
| 5 | **Editing, export and keeping.** Cut and undo (chip text, undo visibility), marks, each annotation kind, the WebM and MP4 export (duration and cues), and keep/restore across a reload. | Each check green on `main`; a deliberately broken behaviour turns its check red. | `test/e2e-editing-export` |
| 6 | **Record flow and publishing.** Webcam and mic on stand-in devices; the capture's handling of a handed-back share; the publish dialog's states and the request it builds, with the network stood in for. | The checks green with fake devices and stubbed routes; the picker itself stated as the person's gap. | `test/e2e-record-publish` |
| 7 | **Docs and cleanup.** The README testing section gains the suite; the two untracked `verify-*.html` files are removed once what they proved is covered; the full check runs. | The suite green; `npm run lint && npm run typecheck && npx vitest run && npm run build` green; the README matches the tree. | `docs/e2e-final` |

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)* | — | — |
