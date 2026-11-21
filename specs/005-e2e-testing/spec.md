# Feature Specification: Automated End-to-End Tests

**Feature Branch**: `chore/e2e-testing`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "We keep finding regressions in the browser boundary after they ship. I want a committed, automated end-to-end testing layer: it drives the real app in a real browser on every pull request and fails when the app's browser-facing behaviour changes."

## Clarifications

### Session 2026-11-21

- Q: Which browser engine must the suite run on first? → A: One engine to begin with; more engines are a later change, so the suite's first version stays small and its cost bounded.
- Q: Where does the take in a check come from? → A: Generated deterministically inside the check — never recorded in real time, and never committed as a binary file.
- Q: Does the suite open the screen-share picker? → A: No. The picker is a check a person runs. The app's handling of a share that is *handed back* is covered, with a stand-in for the share API in place of the picker.
- Q: Which record flows should the suite drive? → A: The capture's handling of a handed-back screen share, **plus** the webcam and mic record flow on stand-in devices. Editing, cutting, annotations and export are proved on deterministic fixture takes rather than on a recording, so the suite stays fast and reproducible.
- Q: What is the most the end-to-end suite may take on a pull request? → A: Under 5 minutes for the whole check on a pull request, the browser install included.
- Q: Should the suite cover the publishing flow with the network stood in for? → A: Yes — the publish dialog's states and the request it builds, with the publishing service stood in for. A live sign-in round-trip stays a person's check.
- Q: Does the committed suite replace the temporary `verify-*.html` harness, or do the two coexist? → A: It replaces it. Browser-facing work is proved by a committed check; the throwaway harness is retired, and a flow the suite cannot drive is a real session by a person.
- Q: How many consecutive green runs must the suite show before it counts as non-flaky? → A: No fixed count. The suite runs once per pull request; an intermittent failure is treated as a bug and fixed at its source, never waited out.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A regression in the browser boundary fails before the merge (Priority: P1)

A maintainer changes the capture, the compositor, the timeline, the export or the keeping. Before the change can land, the suite runs the real app in a real browser and fails on whatever that change broke — the same class of breakage that shipped by hand in the last refactor round: a capture sized from a display track's settings rather than from the picture, a share that stopped asking for the cursor, the frame rate and the pane, a silent share no longer reported, and a compositor that recorded at the wrong size.

**Why this priority**: This is the whole reason the layer is being built. The rules in `src/domain/` are already guarded by unit tests; the browser boundary is the layer with no guard at all, and it is where every recent regression lived. Everything else here is in service of this one story.

**Independent Test**: Take the four named regressions. For each, run the suite against the commit *before* its fix and against the code after it: the check for that regression fails before and passes after. That pair of results is the story, proved on its own.

**Acceptance Scenarios**:

1. **Given** the code before one of the four named fixes, **When** the suite runs, **Then** the check for that regression fails.
2. **Given** the code with the fix, **When** the suite runs, **Then** the same check passes.
3. **Given** a change that breaks a covered flow, **When** its pull request is opened, **Then** the suite fails and the merge cannot land green.

---

### User Story 2 - Browser-facing work is proved by a committed check, not a throwaway harness (Priority: P2)

A contributor changes something drawn, played or encoded. They prove it by adding a check to the suite — built on shared fixtures and a shared boot helper — that stays in the repository, runs on every pull request from then on, and can be read and re-run by anyone. The throwaway `verify-*.html` page, written for one change and deleted before the commit, stops being the way this work is proved.

**Why this priority**: It is what makes the layer pay for itself. A check written once and kept turns each regression from a future risk into a permanent guard; the temporary harness leaves nothing behind, which is exactly how the last four got through.

**Independent Test**: Add a check for one browser-facing behaviour using only the shared fixtures and helper, with no change to the application. It runs green on the current code and red when the behaviour is deliberately broken.

**Acceptance Scenarios**:

1. **Given** the shared fixtures and boot helper, **When** a contributor adds a check for a browser-facing behaviour, **Then** they can do it without changing the application or duplicating setup.
2. **Given** the suite in place, **When** a temporary `verify-*.html` harness would previously have been written, **Then** the behaviour can be covered by a committed check instead, and the verification rules say so.
3. **Given** a new browser-facing behaviour, **When** it is deliberately broken, **Then** the new check fails.

---

### User Story 3 - The suite stays fast, deterministic and honest (Priority: P3)

A maintainer trusts the suite enough to act on it. It finishes in under five minutes, gives the same result every run, needs no network, leaves no state behind between checks, and when it cannot run a check it says so visibly rather than passing quietly. It never makes the ordinary unit-test command slower, and it changes nothing about the app a user runs.

**Why this priority**: A browser suite that flakes or hides its gaps is worse than none, because it teaches people to ignore it. This story is last only because it governs the layer the other two build; it is not optional.

**Independent Test**: Run the suite on unchanged code and confirm it gives the same result every time; break the environment for one check and confirm it is skipped with a stated reason, not passed.

**Acceptance Scenarios**:

1. **Given** unchanged code, **When** the suite runs, **Then** it gives the same result every time, and a one-off failure is treated as a bug fixed at its source rather than a reason to re-run.
2. **Given** a check that cannot run in the environment, **When** the suite runs, **Then** that check is reported as skipped with a reason and does not count as a pass.
3. **Given** the suite, **When** the ordinary test command runs, **Then** it runs the unit tests only, in node, in seconds, unchanged.

---

### Edge Cases

- A change that touches only `src/domain/` — it must be provable by a unit test alone, and must not force the browser suite to run.
- A browser that cannot encode a codec the export check needs — the check is skipped with a loud reason, never silently passed.
- A check that flakes on a timing assumption — it is fixed at the source; nothing is made green by waiting longer.
- The suite needs no network: the publishing service is stood in for, so no check depends on an external round-trip.
- State left behind between checks — the clip, the kept copy and any stored picture are cleared, so the order of checks cannot change a result.
- A reload check — the app's service worker must be out of the way, so a reload reads fresh code and not a cache.
- A check for a flow the browser will not let a machine drive (opening the share picker) — it is named as outside the suite, and every change touching the record flow says so in its pull request.
- A very large or long clip in a check — the fixtures stay small enough that the suite's time does not grow with what it is testing.

## Requirements *(mandatory)*

### Functional Requirements

**What the suite runs against**

- **FR-001**: The suite MUST run the real application in a real browser, as a person loads it — the actual page and its own modules — and MUST NOT test copies, stubs or reimplementations of the application.
- **FR-002**: The suite MUST run automatically on every pull request and MUST block the merge when it fails.
- **FR-003**: The suite MUST exercise, at minimum: the capture's handling of a share that is handed back; the webcam and mic record flow on stand-in devices; the compositor; the timeline's strip, waveform and marks; cutting and undo; each annotation kind; the offline export of both file kinds; the keeping and restoring of a clip across a reload; and the publish dialog's states and the request it builds, with the publishing service stood in for.
- **FR-003a**: The editing, cutting, annotation and export checks MUST run on deterministic fixture takes rather than on a recording, so they are fast and reproducible and never depend on the record flow.

**The regressions it must catch**

- **FR-004**: The suite MUST contain one check per regression named in this specification: the capture sized from the picture rather than a track's settings; the cursor, the frame rate and the pane asked for on a share; a silent share reported; the compositor recording at the size of the picture.
- **FR-005**: Each of those checks MUST be proved to fail on the code before its fix and to pass on the code after it, and both results MUST be recorded with the change that adds them.

**Building a clip without recording one**

- **FR-006**: A check MUST be able to build a clip of any needed length and shape without capturing the screen, and in a time that does not grow with the clip's length as real time does.
- **FR-007**: A take used in a check MUST be real, decodable video, so the application's own duration probe, its thumbnail strip and its encoder run on it unchanged.
- **FR-008**: A check MUST be able to give a take sound, so the waveform and the mixed export are exercised on real audio.
- **FR-009**: The takes a check builds MUST be the same from run to run, so a failure means a change and never chance.

**What is out of reach, said plainly**

- **FR-010**: The suite MUST NOT attempt to open the screen-share picker; that remains a check a person runs.
- **FR-011**: Real audio heard through speakers, real device variety, and a live sign-in round-trip with the publishing service MUST be named as outside the suite, in the place a contributor reads before trusting it.

**The suite's own qualities**

- **FR-012**: The ordinary unit-test command MUST be unchanged, MUST run in node, and MUST NOT run the browser suite.
- **FR-013**: The suite MUST be deterministic: no dependence on real elapsed time beyond what a browser requires, no network, and no shared state carried between checks.
- **FR-014**: A check that cannot run in its environment MUST be reported as skipped, with a stated reason, and MUST NOT be counted as a pass.
- **FR-015**: The suite MUST NOT change the application's runtime behaviour and MUST NOT add a dependency the running app loads.
- **FR-016**: Where the view has something a person would see — a label, a button's visibility, a status line — a check MUST assert on that, and reach for the model only where the view shows nothing.
- **FR-017**: A failing run MUST leave enough evidence — a trace, a screenshot, the log — for a reader to see what happened without re-running it locally.
- **FR-018**: The suite's check on a pull request MUST complete in under 5 minutes on the project's continuous integration, so it is run and not skipped.

**The words, the rules and the process**

- **FR-019**: The new concepts this feature introduces — a fixture take, the boot helper, a regression check, the suite's evidence — MUST be written into `GLOSSARY.md` before they appear in code.
- **FR-020**: The verification rules MUST be amended, in their own change, so that a browser-facing behaviour is proved by a committed check in the suite, and the record flow's real share remains the person's check.
- **FR-020a**: The temporary `verify-*.html` harness MUST no longer be the way a browser-facing change is proved, once the suite covers the behaviour; the harness pattern is retired rather than kept as a parallel practice.
- **FR-021**: The suite MUST ship as a sequence of changes, one per pull request, each leaving the app working; and no change MUST bump the version by hand.

### Key Entities

- **Fixture take**: a real, decodable take built inside a check from a deterministic description of length, shape and sound — not a recording and not a stored binary. The clip under test is built from these.
- **Boot helper**: the shared setup that loads the real application, waits for it to be ready, and builds the state a check needs, so no check repeats the wiring.
- **Regression check**: one check that pins a behaviour that broke before, written so it fails on the code before the fix and passes after.
- **Suite run**: one execution of every check on a pull request, its pass, fail and skipped outcomes, and its evidence.
- **Evidence artifact**: what a failed run leaves behind — a trace, a screenshot, the log — for a reader to diagnose it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the four named regressions are caught: for each, the check fails on the code before the fix and passes after.
- **SC-002**: A change that breaks a covered browser-facing flow cannot merge green.
- **SC-003**: The suite gives the same result every run; an intermittent failure is treated as a bug and fixed at its source, never waited out.
- **SC-004**: The suite's check on a pull request finishes in under 5 minutes, the browser install included, on the project's continuous integration.
- **SC-005**: The unit tests are unchanged and continue to run in node in seconds.
- **SC-006**: A contributor can cover a new browser-facing behaviour by adding a check that uses the shared fixtures and helper, changing no application code.
- **SC-007**: Every change that touches a flow the suite cannot drive says so, in the words of the verification rules, 100% of the time.

## Assumptions

- The runner is a browser-automation test runner that drives the real page and runs headless on the project's continuous integration. The project has chosen **Playwright Test**; its name and configuration belong to the technical plan, not this specification.
- One browser engine is covered at first (the project has chosen Chromium); adding more engines is a later change and is not required here.
- The fixture takes are produced by the same offline encoding path the application already uses for export, so no new runtime capability is needed and the takes are as real as an export.
- The suite runs against the development server, where the application's service worker is already kept out of the way.
- A test runner separate from the unit runner is acceptable, and the unit runner and its command stay exactly as they are.
- The four named regressions are a floor, not a ceiling: the suite is expected to grow checks, and later changes add them.
- This feature amends the verification rules, and per the project constitution that amendment is its own change, with the rules updated before code depends on them.
- No runtime dependency is added; anything the suite needs is a development-only dependency.
