---

description: "Task list for Automated End-to-End Tests"
---

# Tasks: Automated End-to-End Tests

**Input**: Design documents from `/specs/005-e2e-testing/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: This feature **is** the testing layer, so its checks are its implementation, not extra tests. No separate unit tests are added, and the existing node suite is left untouched (FR-012, SC-005). The Verification skill's three levels still hold: a `src/domain/` rule stays proved in node; a browser-facing behaviour is now proved by a committed check in this suite; the screen-share picker remains a real session run by the user.

**Organization**: Tasks are grouped by user story. **Each phase is one or more pull requests** (constitution VI, one change per pull request) — **except this feature, which ships as one pull request** (`chore/e2e-testing`) at the maintainer's request; the phases are then the commits inside it, in order. The plan's seven steps map to the phases like this:

| Plan step | Phase |
|---|---|
| 1 Words and rules | Phase 1 |
| 2 Foundation | Phase 2 |
| 3 Fixture takes and the boot helper | Phase 2 |
| 4 Regression corpus | Phase 3 (US1) 🎯 MVP |
| 5 Editing, export and keeping | Phase 4 (US2) |
| 6 Record flow and publishing | Phase 4 (US2) |
| 7 Docs and cleanup | Phase 6 |

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are in each description
- Field constraints are cited as `data-model.md <Entity.field>`, the canonical source

## Path Conventions

Single project (browser SPA), per plan.md: the application stays in `src/` **untouched**. The new layer lives in `e2e/` at the repository root — `e2e/fixtures/`, `e2e/helpers/`, `e2e/checks/` — with `e2e/playwright.config.ts` for the runner. Node unit tests stay beside the file they prove in `src/` (`*.test.ts`); the suite's checks are `*.spec.ts` under `e2e/checks/` and are never run by `npm test`.

---

## Phase 1: Setup — the words and the rules (branch `docs/e2e-words`)

**Purpose**: The words come first (constitution V) and the verification rule is amended in its own change (plan step 1). No code in this phase.

- [x] T001 [P] Add the six new words to `GLOSSARY.md`, each with a code pointer — **fixture take** (a real, decodable take built in a check from a description, never recorded or committed), **boot helper** (the shared setup that loads the app and seeds a clip), **regression check** (a check that pins a behaviour that broke before), **suite run** (one execution of every check on a pull request, with its evidence), **evidence artifact** (what a failed run leaves behind), **stand-in share** (a canvas stream that takes the place of the picker).
- [x] T002 [P] Amend `.agents/skills/verification/SKILL.md`: the browser proof becomes a **committed check in the suite** (the `verify-*.html` harness is retired), the record flow's real share stays the person's, and the `npm run test:e2e` command is named. Keep the three-level table and the regression post-mortem rule intact (FR-020, FR-020a).

**Checkpoint**: The glossary and the Verification skill name the feature; nothing in `src/` or `e2e/` has changed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The runner, the fixtures and the helpers every check is written against (plan steps 2–3). **No user story can begin until this is complete.**

**⚠️ CRITICAL**: Every check in US1, US2 and US3 depends on the boot helper, the fixture takes and the runner config.

- [x] T003 Add `@playwright/test` (latest 1.x) to `devDependencies` and the `"test:e2e": "playwright test"` script in `package.json`. The `version` field is **not** touched — CI owns it (constitution VI).
- [x] T004 [P] Add `playwright-report/` and `test-results/` to `.gitignore`.
- [x] T005 [P] Create `e2e/playwright.config.ts`: `testDir: 'e2e/checks'`, one `chromium` project, `webServer` running `npm run dev -- --port 5174 --strictPort` on `http://127.0.0.1:5174` with `reuseExistingServer: false`, `workers: process.env.CI ? 2 : 4`, launch args `--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`, `--autoplay-policy=no-user-gesture-required`, and `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'` (`contracts/e2e-support.md` §6).
- [x] T006 [P] Create `e2e/fixtures/takes.ts`: `FixtureSpec` (`data-model.md FixtureSpec.width`, `FixtureSpec.height`, `FixtureSpec.seconds`, `FixtureSpec.fps`, `FixtureSpec.hasAudio`, `FixtureSpec.pattern`) and `FixtureTake` (`data-model.md FixtureTake.blob`, `FixtureTake.seconds`, `FixtureTake.shape`, `FixtureTake.hasAudio`), with `makeTake` / `makeTakes` encoding a **WebM** with a real duration and cues through WebCodecs + Mediabunny in milliseconds, never in real time (`contracts/e2e-support.md` §1; research.md R2).
- [x] T007 [P] Create `e2e/helpers/app.ts`: `boot(page)` returning `goto()` (wait for the status chip to read **Ready**), `clear()` (clear the clip, the kept copy and the stored pictures) and `seed(takes)` (clear the clip and add the given takes through a dynamic import of the app's own module — `e2e/support/app-hooks.ts`, reached at `/@fs/<repo-root>/...`; see research.md R11), with **no application change** (`data-model.md Boot helper.*`; `contracts/e2e-support.md` §2).
- [x] T008 [P] Create `e2e/helpers/stand-ins.ts`: `installStandInShare(page, { silent })` (installed before load, replacing `getDisplayMedia` with a `canvas.captureStream()`) and `askedFor(page)` (the constraints the app passed) (`data-model.md Stand-in share.stream`, `Stand-in share.constraints`; `contracts/e2e-support.md` §3).
- [x] T009 Create `e2e/checks/smoke.spec.ts`: `boot(page).goto()`, assert the status chip reads **Ready**, and assert the app made no network request. Proves the runner, the webServer and the boot helper are wired (quickstart §1).
- [x] T010 Add the `e2e` job beside `quality` in `.github/workflows/ci.yml`: `checkout`, `setup-node` 22, `npm ci`, `npx playwright install --with-deps chromium`, `npm run test:e2e`, and `actions/upload-artifact` of `test-results/` **only on failure** (`data-model.md EvidenceArtifact.kind`, `EvidenceArtifact.path`; `contracts/e2e-support.md` §5).

**Checkpoint**: `npm run test:e2e` runs the smoke check green locally and in CI; `npm test` still runs only the node suite.

---

## Phase 3: User Story 1 — A regression in the browser boundary fails before the merge (Priority: P1) 🎯 MVP

**Goal**: One check per named regression, each proved to fail on the commit before its fix and pass after (plan step 4). This is the whole reason the layer exists.

**Branch**: `fix/e2e-regression-corpus`.

**Independent Test**: For each of the four, run the check against its `beforeCommit` and against the fixed code; the check fails before and passes after (quickstart §3).

- [x] T011 [US1] Write the four regression checks in `e2e/checks/capture.spec.ts`, each asserting what a person would see: the capture sized from the picture rather than a track's settings; the cursor, frame rate and pane asked for (via `askedFor`); a silent share reported (via `installStandInShare(page, { silent: true })`); the compositor at the picture's size (`data-model.md RegressionCheck.name`, `RegressionCheck.behaviour`, `RegressionCheck.beforeCommit`, `RegressionCheck.assertion`; `contracts/e2e-support.md` §3, §4).
- [x] T012 [US1] Prove each check: check out the parent of `e33e157`, `fc582a4`, `416c79b` and `c7e00b8` in turn, run `e2e/checks/capture.spec.ts`, and record the **failing** output and the **passing** output on the fixed code with the pull request (FR-005, SC-001; quickstart §3).

**Checkpoint**: The four regressions each fail before their fix and pass after; the story is independently demonstrable.

---

## Phase 4: User Story 2 — Browser-facing work is proved by a committed check (Priority: P2)

**Goal**: The flows a contributor would otherwise prove with a throwaway harness get committed checks built only on the fixtures and the helper, changing no application code (plan steps 5–6).

**Branches**: `test/e2e-editing-export`, then `test/e2e-record-publish` (two pull requests).

**Independent Test**: Each check runs green on the current code and red when its behaviour is deliberately broken; none changes a file in `src/` (quickstart §2, §4–§9).

- [x] T013 [P] [US2] Create `e2e/checks/timeline.spec.ts`: a two-take clip seeded from fixture takes shows a strip of distinct cells, and the clip's length is the sum of the takes (`data-model.md Check.given`, `Check.when`, `Check.then`; quickstart §2).
- [x] T014 [P] [US2] Create `e2e/checks/cutting.spec.ts`: clicking the timeline marks a section, the scissors turns it into a cut, the chip's text and the undo button appear, and undo restores the length (FR-016; quickstart §4).
- [x] T015 [P] [US2] Create `e2e/checks/annotations.spec.ts`: an arrow, an image and a text annotation can each be placed, moved, resized, copied, pasted and deleted through the real canvas (quickstart §5).
- [x] T016 [P] [US2] Create `e2e/checks/export.spec.ts`: exporting WebM and MP4 downloads a file that decodes with the right duration and cue points (`data-model.md SuiteRun.outcomes`; quickstart §6).
- [x] T017 [P] [US2] Create `e2e/checks/keeping.spec.ts`: after a reload the clip comes back into the review with its takes and cuts (`data-model.md Check.given`; quickstart §7).
- [x] T018 [US2] Create `e2e/checks/record.spec.ts`: with the fake camera and mic, turning Webcam on and recording produces a take, and the capture's handling of a handed-back share asks for the cursor, frame rate and pane; state the picker gap in the file (FR-010, FR-011; quickstart §8).
- [x] T019 [US2] Create `e2e/checks/publishing.spec.ts`: the publish dialog's sign-in, compose and error states render and the request the app builds is asserted, with the publishing service stood in for via `page.route` (quickstart §9).

**Checkpoint**: Every flow the spec names is covered by a committed check; a contributor can add another using only `e2e/fixtures/takes.ts` and `e2e/helpers/app.ts` (SC-006).

---

## Phase 5: User Story 3 — The suite stays fast, deterministic and honest (Priority: P3)

**Goal**: No shared state, no fixed waits, loud skips, no network, and the run inside its budget (plan steps 5–6, hardened).

**Branch**: `test/e2e-hardening`.

**Independent Test**: The suite gives the same result every run; a check that cannot run is reported **skipped** with a reason, not passed (quickstart §10).

- [x] T020 [US3] Ensure every check calls `boot(page).clear()` before it seeds, so the clip, the kept copy and the stored pictures never carry between checks (`data-model.md Check` state transitions; FR-013). **Done** — `boot().seed()` clears the clip itself, so no check can inherit a take; checks that seed nothing touch no clip state.
- [x] T021 [US3] Replace every fixed wait with a visible-state or event wait — no `setTimeout` fallback, no re-run to go green (`data-model.md Check` state transitions; FR-013, SC-003). **Done** — waits are on the chip, the strip, a poll of the model or an event. The two `setTimeout(resolve, 3000)` in `compositor.spec.ts` and `export.spec.ts` are bounded fallbacks for a `loadedmetadata` event that never fires: they make the check *fail* sooner, never pass.
- [x] T022 [US3] Add the skip-with-reason pattern, `test.skip(true, '<reason>')`, where a capability may be missing — the codec the export check needs, at least — so it is reported skipped and never counted as a pass (`data-model.md Check` state transitions, `SuiteRun.outcomes`; FR-014).
- [x] T023 [US3] Confirm the suite makes no network request (the publishing service is the only external call and it is routed) and that `npm test` runs only the node suite, unchanged (FR-012, SC-005).
- [x] T024 [US3] Confirm the `e2e` job finishes in under 5 minutes in CI and record the measured time (`data-model.md SuiteRun.duration`; SC-004). **Measured**: locally 17 checks in about 8 s with 4 workers; in CI on pull request #154 the **End-to-end (Chromium)** job took **2 m 6 s** (the whole run 2 m 11 s), well inside the 5-minute budget.

**Checkpoint**: The suite is trustworthy enough to be a required gate.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: The docs match the tree, the throwaway harnesses retire (plan step 7).

- [x] T025 [P] Update the README testing section (around lines 242–245) to name the suite, the `npm run test:e2e` command and the amended verification rule.
- [x] T026 [P] Remove `verify-strip-shapes.html` once what it proved is covered by a committed check (FR-020a). **Done** — the strip's cells are covered by `e2e/checks/timeline.spec.ts`.
- [x] T028 [P] Add a committed check for the thumbnail's `object-fit: cover` (`src/ui/clip/thumbnail.ts`), then remove `verify-object-fit.html` (FR-020a). **Done** — `e2e/checks/thumbnails.spec.ts` builds a portrait take and asserts the bitmap keeps its shape and the cell crops it; it fails when the stylesheet's `object-fit` is set to `fill`. Both `verify-*.html` files are now gone.
- [x] T027 Run the full gate — `npm run lint && npm run typecheck && npx vitest run && npm run test:e2e && npm run build` — and record the result in the final pull request (quickstart, final command).

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)** — no dependencies; must precede any `e2e/` code (constitution V).
- **Phase 2 (Foundational)** — depends on Phase 1; blocks all user stories.
- **Phase 3 (US1)** — depends on Phase 2; the MVP.
- **Phase 4 (US2)** — depends on Phase 2; independent of US1.
- **Phase 5 (US3)** — depends on the checks it hardens (US1 and/or US2); can start once the first checks exist.
- **Phase 6 (Polish)** — depends on US1 and US2 being covered.

### Story dependencies

- **US1 (P1)**: needs the runner, fixtures and stand-ins only.
- **US2 (P2)**: needs the runner, fixtures and boot helper; does **not** need US1.
- **US3 (P3)**: a quality pass over whatever checks exist; needs US1 or US2.

### Within a phase

- Phase 2: T003 (dependency/script) before T009 (smoke) and T010 (CI); T005–T008 are independent files.
- Phase 3: T011 before T012.
- Phase 4: T013–T017 are independent files; T018 and T019 are independent.

## Parallel Execution Examples

**Phase 2** (after T003):

```text
T004 .gitignore   T005 playwright.config.ts   T006 fixtures/takes.ts
T007 helpers/app.ts   T008 helpers/stand-ins.ts
```

**Phase 4** (US2) — the checks touch different files:

```text
T013 timeline.spec.ts   T014 cutting.spec.ts   T015 annotations.spec.ts
T016 export.spec.ts     T017 keeping.spec.ts
```

**Phase 6**:

```text
T025 README.md   T026 remove verify-*.html
```

## Implementation Strategy

### MVP first

Phase 1 → Phase 2 → **Phase 3 (US1)**. That delivers the story the feature exists for: the four regressions fail before a merge. Stop there, prove the four fail-before/pass-after pairs, and only then widen.

### Incremental delivery

1. Words and rules (Phase 1) — no code, the skill amended.
2. Foundation (Phase 2) — the runner and the smoke check.
3. **US1 (Phase 3)** — the regression corpus, as its own pull request.
4. US2 (Phase 4) — the flows, in two pull requests.
5. US3 (Phase 5) — the determinism and budget pass.
6. Polish (Phase 6) — docs and the retired harnesses.

Each pull request leaves both suites green, adds no `src/` change, and never bumps `package.json`'s `version`.

## Notes

- The application is **not** modified: every check reaches the app through the dev server's own module URLs, as a browser does (FR-001, FR-015).
- Fixtures are **WebM**, because `offline-encoder` reads takes with `formats: [WEBM]`; even the MP4 export check is fed a WebM take (research.md R2).
- The screen-share **picker**, real audio, real device variety and a live sign-in round-trip stay the person's checks, and every change touching the record flow says so (FR-010, FR-011).
- Making the `e2e` job a **required status check** is a repository setting the maintainer applies; the workflow only provides the job.
