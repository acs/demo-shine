# Phase 1 — Data Model: Automated End-to-End Tests

This feature adds no application data. Its "data model" is the **test-support
objects** a check is built from, and the rules the spec puts on them. Everything
here lives in `e2e/` and in CI config; nothing here touches `src/`.

## FixtureSpec

The description a fixture take is generated from. A plain value object.

| Field | Type | Rule |
|---|---|---|
| `width` | number | > 0; a typical "screen" take is 1280×720, a "tab" take 600×400 |
| `height` | number | > 0 |
| `seconds` | number | > 0; the take's **exact** duration |
| `fps` | number | > 0; frames are laid down at a fixed rate, not in real time |
| `hasAudio` | boolean | false for a silent take; true adds an audio track |
| `pattern` | string | how each frame is drawn — a numbered solid colour, so cells are distinguishable |

## FixtureTake

A real, decodable take built inside a check. It is the unit the clip under test is
built from — the replacement for recording one.

| Field | Type | Rule |
|---|---|---|
| `index` | number | where the take's blob is kept in the page, for `boot.seed` to read back |
| `seconds` | number | the spec's `seconds`; the file carries a real duration and cues |
| `shape` | string | `${width}×${height}`, for assertions on the strip |
| `hasAudio` | boolean | whether the file carries a sound track |

The blob itself **stays in the page** (it is a browser `Blob`, not something a test
holds); the test carries only the metadata above.

**Validation**: the blob decodes (the app's own `take-probe` reads its duration); the
duration matches `seconds` to within one frame; two takes from the same spec are the
same from run to run (FR-009). A take is built in **milliseconds**, never in real
time (FR-006), and it is never committed as a binary.

## Boot helper

The shared setup every check starts from. Not data, but the capability the data is
used through; its contract is in `contracts/e2e-support.md`.

| Operation | Effect |
|---|---|
| `goto()` | navigate to `/` and wait for the status chip to read **Ready** |
| `seed(takes)` | clear the clip and add the given takes, through the app's own module |
| `clear()` | clear the clip, the kept copy and the stored pictures — so no check inherits state |

**Rule**: the helper changes **no application code**; it reaches the app's own
modules through the dev server's URLs (FR-001, FR-015).

## Stand-in share

A `canvas.captureStream()` that takes the place of `getDisplayMedia`, installed before
the app loads.

| Field | Type | Rule |
|---|---|---|
| `stream` | `MediaStream` | a video track from a canvas; may be silent or carry a track |
| `constraints` | object | what the app asked for, captured so a check can assert the cursor, frame rate and pane |

**Rule**: the picker itself is never opened (FR-010). The stand-in exists so the
app's handling of a **handed-back** share — size, constraints, a silent share — is
covered, which is where the four regressions lived.

## Regression check

A check that pins a behaviour that broke before.

| Field | Type | Rule |
|---|---|---|
| `name` | string | names the regression, in the project's words |
| `behaviour` | string | what used to work |
| `beforeCommit` | string | the commit **before** the fix, the check is run against |
| `assertion` | string | what a person would see that the fix restored |

**Rule**: for each, the check **fails** on `beforeCommit` and **passes** on the fixed
code; both results are recorded with the change that adds it (FR-004, FR-005,
SC-001). The four: capture sized from the picture; cursor/frame-rate/pane asked for;
a silent share reported; the compositor at the picture's size.

## Check

One test case, a `*.spec.ts` file's `test(...)`.

| Field | Type | Rule |
|---|---|---|
| `given` | string | the state, built with the boot helper and fixtures |
| `when` | string | the real interaction — a click, a drag, an export |
| `then` | string | what a person would see (a label, a button, a status line) where the view shows something (FR-016) |

**State transitions**: `pending → running → passed | failed | skipped`. A check that
cannot run in its environment ends **skipped, with a stated reason**, and is **not**
counted as a pass (FR-014).

## Suite run

One execution of every check on a pull request.

| Field | Type | Rule |
|---|---|---|
| `outcomes` | per check: passed / failed / skipped | skipped is distinct from passed |
| `duration` | number | under 5 minutes, the browser install included (SC-004) |
| `evidence` | `EvidenceArtifact[]` | produced **only on failure** |

**Rule**: the run is deterministic — the same code gives the same outcomes every run;
an intermittent failure is a bug fixed at its source, never waited out (SC-003,
FR-013).

## Evidence artifact

What a failed run leaves behind for a reader.

| Field | Type | Rule |
|---|---|---|
| `kind` | `trace` \| `screenshot` \| `video` \| `log` | a trace on first retry; a screenshot and video on failure |
| `path` | string | under `test-results/`, uploaded by the CI job on failure |

**Rule**: enough to see what happened **without re-running locally** (FR-017).

## Relationships

```text
SuiteRun 1 ── * Check
Check    1 ── * FixtureTake          (the clip under test)
Check    0 ── 1 StandInShare         (only the capture checks)
Check    0 ── 1 RegressionCheck      (the check is one, with a beforeCommit)
SuiteRun 1 ── * EvidenceArtifact     (only when the run fails)
FixtureSpec 1 ── 1 FixtureTake       (a spec is generated into one take)
```

No entity here has a lifecycle longer than a run: fixtures are generated, used and
dropped; the clip, the kept copy and the stored pictures are cleared between checks.
