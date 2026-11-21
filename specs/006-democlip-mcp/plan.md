# Implementation Plan: DemoClip MCP

**Branch**: `feat/democlip-mcp` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-democlip-mcp/spec.md`

## Summary

An agent — OpenCode first — starts a session from the chat, which opens a browser on
DemoClip. The person records there exactly as they always have, choosing what to share
in the browser's own picker; the agent drives the recording and the editing, and the
person watches every change land in that window and can take any of it back with the
app's own undo.

Two pieces make it up: a small, deliberately bounded **automation surface** in the app
(the app's own operations, reachable only when a page asks for it), and an **MCP server**
that launches the browser, serves the app's own build, and offers those operations to the
agent as tools named in the app's vocabulary. The server lives in this repository and is
released with the app, sharing its version, so how a clip is written down cannot drift
between them.

## Technical Context

**Language/Version**: TypeScript ^6.0.3, ES modules, strict, for both the app and the server. The server runs on Node (the version the repository's engines name; the app is browser-only).

**Primary Dependencies**: Vite ^8.3.8 and Vitest ^5.1.0 (app, existing); Playwright (already a dev dependency for the end-to-end suite) for the server's browser; the MCP SDK for the server's protocol. **The app gains no runtime dependency** — the surface is a module of the app it already is.

**Storage**: unchanged. The clip stays where it is (in the app, kept in IndexedDB), and the only new file is an export the person asked for, written where the server puts it.

**Testing**: Vitest in node for the surface's own rules and the server's tool schemas and refusals; the **committed end-to-end suite** in `e2e/` for the surface — it drives the real app in headless Chromium, and a new check navigates to the gated surface and asserts what a person would see; a **real session by the user** for the two things no check can do — the agent's press opening the share picker, and a real publish to a real account.

**Target Platform**: a desktop with a display — the browser is opened headful, on purpose, because the person is watching it. macOS, Windows and Linux.

**Project Type**: the browser application as it is, plus a local Node package beside it (`mcp/`), released together.

**Performance Goals**: a change the agent makes is visible in the person's window in under a second (spec SC-002) — the surface calls the same operations the buttons call, so the app's own views redraw on the next frame. An export is as fast as it already is offline.

**Constraints**: no new runtime dependency in the app. The surface must exist **only** when a page asks for it, and must offer the app's operations and nothing else. The recording is never re-encoded. One clip and one session at a time. One step per pull request, and CI owns the version — now for two artefacts that must carry the same one. The words go into `GLOSSARY.md` before they appear in code.

**Scale/Scope**: one new app module (the surface) and its gating in `main.ts`; one new package (`mcp/`) of a few modules; one new area of e2e checks; the words, the README and the release workflow. The app's four layers and its domain are untouched except for the wiring that publishes the surface.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status | Evidence |
|---|---|---|---|
| I. The skills are the constitution | The plan must not disagree with `.agents/skills/` or `GLOSSARY.md`; new words go in the glossary first | PASS | Step 1 adds **agent session**, **agent harness**, **operation**, **automation surface** and **MCP server** to `GLOSSARY.md`, and updates the Overview and Domain model skills' maps, before any code moves. |
| II. `src/domain/` is pure | No DOM, no browser API, no import from `ui/` or `infra/`; a collaborator is a port | PASS | The surface is `ui/` code calling the app's existing flows and use cases; the domain gains nothing. The server is outside `src/` entirely and reaches the app only through the page. |
| III. Every rule has a test beside it | A rule in `domain/` is proved by a unit test in node; a refactor's proof is the old tests passing unmodified | PASS | No domain rule is added, so no domain test changes. The server's own rules — which operations exist, what a refused call returns, the version check — get node tests beside them. |
| IV. What is drawn, played or encoded is proved in a browser | A committed check in `e2e/`, run in a real browser; the recorder's flow is a real session by the user | PASS | The surface gets `e2e/checks/agent.spec.ts`; the two things no check can do — the agent's press opening the picker, and a real publish — are named as the user's real session, in `quickstart.md`. |
| V. The words come first | A new concept is written into `GLOSSARY.md` before it appears in code | PASS | Step 1 is a docs-only change. |
| VI. One change per pull request, and CI owns the version | A plan's step gets its own branch and pull request; `package.json` is never bumped by hand | PASS | Seven steps, each its own branch and pull request; no step edits a version by hand, and the release step has CI stamp the server with the app's version. |

No violations. The Complexity Tracking table stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/006-democlip-mcp/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities
├── quickstart.md        # Phase 1 verification guide
├── contracts/
│   ├── agent-surface.md # What the app offers to be driven
│   └── mcp-tools.md     # What the harness sees
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── spec.md              # Feature specification
```

### Source Code (target layout)

```text
web/                     # the web shell (unchanged)
src/
├── ui/
│   ├── agent/
│   │   ├── surface.ts   # NEW — the app's operations, as one bounded object
│   │   └── surface.test.ts # NEW — its own rules: what it refuses, what it reports
│   ├── recording/       # the source toggles and takes it drives (existing)
│   ├── cutting/, annotating/, exporting/, publishing/  # the flows it calls (existing)
│   └── ...
├── main.ts              # publishes the surface when the page asks for it
e2e/
├── checks/
│   └── agent.spec.ts    # NEW — the surface, driven in a real browser
└── helpers/             # boot, stand-ins, page modules (existing)
mcp/                     # NEW — the server, released with the app
├── package.json         # its own dependencies: Playwright, the MCP SDK
├── src/
│   ├── server.ts        # the MCP server: the tools, over stdio
│   ├── browser.ts       # launching and owning the browser, and serving the app's build
│   ├── tools.ts         # the tool list, in the app's vocabulary
│   └── version.ts       # the app's version it ships, and the check it makes
└── src/*.test.ts        # node tests: the tool schemas, refusals, the version check
```

**Structure Decision**: the app keeps its four layers and its `web/` shell; the surface is
a `ui/` module because it drives the app's own flows and owns no rules of its own. The
server is a **package beside the app** (`mcp/`), not part of `src/`, because it runs in
Node and is a second thing to release — but it is released from this repository with the
app's version, and it ships the app's own build so the two agree by construction. The
suite's checks live where every other check lives, `e2e/checks/`.

## Implementation Sequence

Each step is its own branch and pull request. A step leaves the app working, its unit
tests green and the end-to-end suite green.

| Step | Change | Proof | Pull request |
|---|---|---|---|
| 1 | **Words and map.** Add **agent session**, **agent harness**, **operation**, **automation surface** and **MCP server** to `GLOSSARY.md`; update the Overview and Domain model skills' maps. No code. | Docs review. | `docs/agent-words` |
| 2 | **The surface, reading and editing.** Add `src/ui/agent/surface.ts`: the clip described as data (length, takes, cuts, annotations and their properties) and the editing operations — cut, annotate, set a property, remove, undo, seek, play, pause — each calling the app's own flow. Publish it in `main.ts` only when the page asks (`?agent=1`). | A node test for what the surface refuses; `e2e/checks/agent.spec.ts`: navigate with the flag, drive a cut and an annotation through the surface, and assert what a person sees in the timeline and the picture — and that a page without the flag has no surface at all. | `feat/agent-surface-edit` |
| 3 | **The surface, recording.** The source toggles and the takes: turn a source on and off, start and stop a take — the last of which is the app's own flow, so the take arrives as it always does. | An e2e check with the stand-in share: the surface turns the screen source on, and the check asserts the app *asked* for a share, that the call carried the person's activation, and that a take started and stopped through the surface lands in the clip. The real picker is the user's session. | `feat/agent-surface-record` |
| 4 | **The surface, out.** Export — which writes the file the app already writes — and publish, which reuses the app's publishing flow and refuses with a reason when nobody is signed in. | An e2e check: an export through the surface produces a download the check can read, and holds the edit; a publish without a sign-in is refused with a reason and nothing leaves the page. | `feat/agent-surface-out` |
| 5 | **The server.** `mcp/`: the server over stdio, the tools named in the app's vocabulary, the browser it launches headful on a profile of its own, the app's build served on loopback, the version check, and the download read out to a path the person is told. | Node tests beside the server: the tool list, what each returns, and the refusals (no browser, a version that does not match, a publish without a sign-in). One integration check that starts the server, calls a tool and sees the app change. | `feat/mcp-server` |
| 6 | **Install and release.** The README's section on adding the server to a harness (OpenCode first), and the release workflow: CI stamps the server with the app's version and publishes it, with the app's build inside it, on the same merge. | A dry run of the packaging locally; the workflow reviewed against the version rule; the README's instructions followed once by hand. | `feat/mcp-install-release` |
| 7 | **Real session and final verification.** The two things no check can do, run by the user: the agent's press opening the share picker in a real browser, and a real publish to a real account. The full gate, and the honest gaps. | The three levels of the Verification skill; the suite green; the user's session reported in the pull request. | `docs/agent-final` |

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. The change adds no rule to the domain and no dependency to the app. The
complexity it does add is a **second artefact to release** (`mcp/`) whose version must
match the app's, and a **second way to drive the app** (the surface) that must stay the
app's own operations — both are answered by construction: the server ships the app's
build, and the surface is a thin caller of the flows the buttons call.

## Post-Design Constitution Check

Re-checked after the Phase 1 design artifacts were written.

| Principle | Result | Evidence |
|---|---|---|
| I. The skills are the constitution | PASS | The plan follows the Domain model skill (the surface is `ui/`, the domain untouched) and the Verification skill (a committed `e2e/` check, and the recorder's flow as a real session). Step 1 updates the glossary and the skills first. |
| II. `src/domain/` is pure | PASS | `contracts/agent-surface.md` keeps the surface in `ui/`, calling the app's flows; the server is outside `src/` and reaches the app only through the page. |
| III. Every rule has a test beside it | PASS | The surface's refusals and the server's tool list and version check have node tests; the domain's tests are untouched. |
| IV. What is drawn, played or encoded is proved in a browser | PASS | `quickstart.md` names `e2e/checks/agent.spec.ts` for the surface and the export, and states plainly that the picker press and a real publish are the user's session. |
| V. The words come first | PASS | Step 1 is docs-only. |
| VI. One change per pull request, and CI owns the version | PASS | Seven steps, each its own branch and pull request; CI stamps the server with the app's version rather than a hand bump. |

No new violations. The design is ready for `/speckit.tasks`.