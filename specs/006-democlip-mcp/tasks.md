---

description: "Task list for DemoClip MCP"
---

# Tasks: DemoClip MCP

**Input**: Design documents from `/specs/006-democlip-mcp/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — the project's constitution makes them part of done. The surface's own rules and the server's (the tool list, the refusals, the version check) are proved by **unit tests in node** beside them (Principle III); the surface end to end, the export's file and a refused publish are proved by **committed checks in `e2e/`**, in a real browser (Principle IV); the agent's press opening the share picker, and a real publish, are the **user's real session**, because no check can open a picker or hold an account. A check is `e2e/checks/agent.spec.ts`, and no temporary harness is written (the word is retired — `GLOSSARY.md`, "Words we do not use").

**Organization**: Tasks are grouped by user story. **Each phase is one or more pull requests** (Principle VI); the branch name is in each phase heading. The plan's seven steps map like this:

| Plan step | Phase |
|---|---|
| 1 Words and map | Phase 1 (T001–T002) |
| 2 The surface, reading and editing | Phase 2 (T003–T007) + Phase 3 (T015–T019) |
| 3 The surface, recording | Phase 3 (T017–T018, T022, T025) |
| 4 The surface, out | Phase 4 (T026–T028, T030, T032–T033) |
| 5 The server | Phase 2 (T008–T014) + Phase 3 (T020–T023) + Phase 4 (T029, T031) |
| 6 Install and release | Phase 6 (T039–T043) |
| 7 Real session and final verification | Phase 5 (T034–T038) + Phase 6 (T044–T046) |

Step 5 is carried by the phases whose tools it adds, on purpose: the server cannot offer a tool for an operation the surface does not yet have. The server's skeleton lands in Phase 2; each story's tools land with that story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are in each description
- Field constraints are cited as `data-model.md <Entity.field>`, the canonical source

## Path Conventions

Two artefacts, per plan.md. The app keeps its four layers: domain in `src/domain/`, use cases in `src/application/`, adapters in `src/infra/`, the view in `src/ui/` — the surface is `src/ui/agent/`, and the app's entry `src/main.ts` publishes it. The server is its **own package** in `mcp/` (`mcp/src/`), outside the app's `tsconfig` (`include: ["src", "web"]`) and its `vitest` (`include: ["src/**/*.test.ts"]`), with its own scripts. Unit tests sit beside the file they prove. End-to-end checks are `e2e/checks/*.spec.ts`. Nothing is written to the repository root.

---

## Phase 1: Setup — the words (branch `docs/agent-words`)

**Purpose**: The words come first (constitution V, plan step 1). No code.

- [x] T001 Add the five words to `GLOSSARY.md`, in a new "Being driven by an agent" section beside "The architecture" — **agent session** (one sitting: the browser the server opened, the clip in it, and the person watching), **agent harness** (the chat that starts the server and offers its operations to the model — OpenCode first), **operation** (one thing the agent may do, named in the app's vocabulary), **automation surface** (what the app offers to be driven, deliberately bounded to its own operations; `src/ui/agent/surface.ts`), **MCP server** (the local program that launches the browser and offers the operations as tools; `mcp/`) — each with its code pointer. Add **MCP**, **tool** and **headful** to "Words we do not use" only if they are being used loosely; do not invent a second word for **operation**.
- [x] T002 [P] Update the module maps: `.agents/skills/overview/SKILL.md` (the app's `ui/agent/` group, and `mcp/` beside `src/` as a second artefact released with the app) and `.agents/skills/domain-model/SKILL.md` (the surface is `ui/` code calling the app's flows; it adds no rule, and `src/domain/` is untouched by this feature).

**Checkpoint**: The glossary and the skills name the feature; nothing in `src/` or `mcp/` exists yet.

---

## Phase 2: Foundational (Blocking Prerequisites) — the gate, the surface, and the server it needs (branches `feat/agent-surface`, `feat/mcp-server`)

**Purpose**: The surface object, the gate that publishes it, and the server that opens the browser and reaches it. **No user story can be told until this is complete** — every operation, and every tool, needs the object to exist and be reachable.

**⚠️ CRITICAL**: US1, US2 and US3 all build on this.

### The surface and the gate

- [ ] T003 Create `src/ui/agent/surface.ts` — the shape and the gate, and nothing else: `AgentSurface` (`data-model.md AgentSurface`), the result union `Result<T> = ({ ok: true } & T) | { ok: false; reason: string }` (`data-model.md Operation.result`), `ClipDescription`, `TakeSummary`, `AnnotationSummary`, `AnnotationParams`, and `agentAskedFor(search: string): boolean` reading the flag the page was opened with (`contracts/agent-surface.md` §1). **DOM-free**: no import of `el`, `session`, or any `-flow` module, so a node test can import it. Declare `democlip?: AgentSurface` on `Window` in `src/globals.d.ts`.
- [ ] T004 [P] Create `src/ui/agent/describe.ts` — `describeClip(clip: Clip): ClipDescription` (`data-model.md AgentSurface.describe`), taking the clip as an argument so it is DOM-free and testable: the length, the kept length, the takes and the cuts (`data-model.md ClipDescription.{length,keptLength,takes,cuts}`), and each annotation's id, kind, span and properties with the value it holds (`data-model.md ClipDescription.annotations`, `data-model.md AnnotationSummary.{id,kind,span,properties}`), the property values read through `propertiesOf` so the agent sees exactly what the inspector renders.
- [ ] T005 [P] Export `appVersion(): string` from `src/ui/shell/version.ts` — the one reader of the build's `__APP_VERSION__` — and have `initVersion` use it too, so there is one place the version is read (`data-model.md AgentSurface.version`; `contracts/agent-surface.md` §2; `research.md` D7).
- [ ] T006 Publish the surface in `src/main.ts` **only when the page asked for it**: `if (agentAskedFor(window.location.search)) window.democlip = createAgentSurface({ clip: session.clip, version: appVersion() })`. A page without the flag publishes nothing — no global, no listener, no timer (`contracts/agent-surface.md` §1; `research.md` D1).
- [ ] T007 [P] Create `src/ui/agent/surface.test.ts` (node, DOM-free): `agentAskedFor` accepts `?agent=1` and refuses `''`, `?agent=0`, `?agent` and an unrelated query; `describeClip` over a `Clip.empty` with a `FakeTakes` (the pattern of `src/domain/clip/Clip.test.ts`) reports the length, no cuts and no annotations, and one added annotation reports its kind, span and property values (`data-model.md ClipDescription`, `AnnotationSummary`); the refusal shape is `{ ok: false, reason }`.

### The server

- [ ] T008 Create the server package: `mcp/package.json` (name `democlip-mcp`, `type: module`, the app's version, its own deps `@modelcontextprotocol/sdk` and `playwright`, and `build`/`test`/`start` scripts), `mcp/tsconfig.json` (node, out `mcp/dist`), `mcp/eslint.config.js` (node globals). Add `mcp/**` to the root `eslint.config.js` ignores so the app's `npm run lint` is unchanged; the app's `tsconfig` already excludes it. Also create `mcp/src/version.ts` — the version the server was built with, generated from the app's `package.json` at build time (a small script), so in the repository it already equals the app's (`research.md` D3, D7).
- [ ] T009 Create `mcp/src/browser.ts` — launch Chromium **headful** through Playwright on a **profile of its own** (a `launchPersistentContext` with a user-data dir under the OS application-support/temp dir, never the person's everyday profile), open the app at `?agent=1`, and close it when the session ends. A `headless` option exists for the server's own integration check only; the default stays headful (`research.md` D3, D8).
- [ ] T010 [P] Create `mcp/src/serve.ts` — serve a directory of the app's build over HTTP on `127.0.0.1` at a free port, with the MIME types the build needs, and stop it when the session ends. Loopback is a secure context, which is what screen capture requires (`research.md` D3).
- [ ] T011 Create `mcp/src/server.ts` and `mcp/src/index.ts` — the MCP server over stdio, one session at a time (`data-model.md AgentSession`): open the browser and the page, read `window.democlip.version` and compare it with `mcp/src/version.ts`, and **refuse to drive a page that does not match**, with a reason (`research.md` D7); the bin entry starts the server.
- [ ] T012 [P] Create `mcp/src/tools.ts` — the tool registry: for each tool a name, a description a model can act on, an input schema and a dispatch (`data-model.md Tool`). Start with `describe_clip` alone. There is no tool that evaluates code or scripts the page (`contracts/mcp-tools.md` §1).
- [ ] T013 [P] Create the server's node tests beside the modules: the version check refuses a page whose version does not match, with a reason, before any tool runs; the tool registry holds no code-evaluating tool; a session with no browser available is reported plainly and nothing half-starts (`data-model.md Tool`; `research.md` D7).
- [ ] T014 Create one integration check in `mcp/` that starts the server (browser headless), calls `describe_clip`, and sees the app answer with the clip's shape — the server, end to end, before any editing tool exists (`plan.md` step 5; `research.md` D9).

**Checkpoint**: A page opened with `?agent=1` publishes the surface; a page without it publishes nothing; the server opens a browser on that page, agrees on the version, and answers `describe_clip`.

---

## Phase 3: User Story 1 — Record in the browser it opens, then edit it by talking (Priority: P1) 🎯 MVP

**Goal**: The surface's editing, view and recording operations, their tools, and the trusted press that opens the share picker (plan steps 2, 3 and 5's tools).

**Branch**: `feat/agent-surface-record`.

**Independent Test**: Start the session, record a short clip with the browser's own picker (or hand it one already recorded), ask in the chat for a cut and an arrow, and see both in that window and in the timeline; then press the app's one undo.

### Implementation for User Story 1

- [ ] T015 [US1] Create `src/ui/agent/edit.ts` — the editing operations, each calling the app's own flow and returning a `Result`: `cut(from, to)` through `Span.between(from, to, MIN_SECTION)` and `clip.approve`; `annotate(kind, params)` through the kind's plugin and `clip.addAnnotation`; `setProperty(id, property, value)` through the property's `with` and `clip.changeAnnotation`; `remove(id)` through `clip.removeAnnotation`; `undo()` through `clip.undo`. A refusal is a value — a stretch below `MIN_SECTION`, an unknown kind, a property value the kind refuses, a non-string value — returning `{ ok: false, reason }` and leaving the clip unchanged (`data-model.md Operation`, `data-model.md AgentSurface.edit`; `contracts/agent-surface.md` §2; spec FR-005, FR-007, FR-008).
- [ ] T016 [US1] Create `src/ui/agent/view.ts` — `seek(seconds)`, `play()`, `pause()` through the app's `playback`, returning a `Result` (`data-model.md AgentSurface.view`; `contracts/agent-surface.md` §2).
- [ ] T017 [US1] Create `src/ui/agent/takes.ts` — the recording operations through the app's own flows so the person sees them: `takes.start()` and `takes.stop()` through `record-flow.ts`, and `sources()` reading `capture.sources`; `turnSourceOff('screen' | 'webcam' | 'microphone')` through the app's toggles, and `turnSourceOn` for `webcam` and `microphone` only. **Turning the screen source on is deliberately absent** — it opens the picker and needs the person's activation, so the server delivers that one press (T022) (`data-model.md AgentSurface.{takes,sources}`; `contracts/agent-surface.md` §2; `research.md` D2; spec FR-004, FR-005).
- [ ] T018 [US1] Export `startTake()` from `src/ui/recording/record-flow.ts` (today `startRecording` is private and only `toggleRecord` reaches it), so the surface can start and stop a take explicitly rather than inferring from the phase. Change no behaviour for the buttons.
- [ ] T019 [US1] Assemble `createAgentSurface(...)` in `src/ui/agent/surface.ts` from `describe`, `edit`, `view`, `takes` and `sources`, and wire it in `src/main.ts` under the gate (T006). Annotate supports the kinds whose shape is **data** — `arrow` and `text`; `image` is refused with a reason, because its picture is a file the person chooses, exactly as the share is. Record that as the one place FR-005 is bounded, in the pull request, so it can be decided rather than assumed.
- [ ] T020 [P] [US1] Create `src/ui/agent/edit.test.ts` (node, DOM-free): each refusal above returns `{ ok: false, reason }` and leaves the clip unchanged — a stretch below `MIN_SECTION`, an unknown kind, a property value the kind refuses — and a refused call announces nothing (`data-model.md Operation`; spec FR-008).
- [ ] T021 [P] [US1] Add US1's tools to `mcp/src/tools.ts` with schemas and dispatch: `describe_clip`, `cut`, `annotate`, `set_property`, `remove_annotation`, `undo`, `seek`, `start_take`, `stop_take`, `turn_source_on`, `turn_source_off` (`data-model.md Tool`; `contracts/mcp-tools.md` §1). An app-level refusal is returned as the tool's result, not a transport error, so the agent can read it and try again.
- [ ] T022 [US1] Create `mcp/src/press.ts` — `turn_source_on('screen')` delivered as a **real input event** (a trusted click on `#screenBtn`) through the browser, so it carries the transient activation the picker requires. It never chooses what is shared (`research.md` D2; spec FR-004; `contracts/mcp-tools.md` §1).
- [ ] T023 [P] [US1] Extend the server's node tests: the US1 tool list is exactly the operations, each schema names the app's own inputs, and no tool evaluates code (`contracts/mcp-tools.md` §1; spec FR-015, FR-016).
- [ ] T024 [US1] Create `e2e/checks/agent.spec.ts` — the surface, driven the way the server drives it, and **what a person sees**: with `?agent=1` `window.democlip` is there and its `version` is the app's, and without the flag it is absent; after `boot.seed` and `boot.review`, `describe()` reports the takes and no cuts; a `cut` leaves the chip saying what was cut and the undo button visible; an `annotate` of an `arrow` draws on the picture and marks the lane; a `setProperty` on a colour changes what the layer paints and one `undo` puts it back; a cut below the minimum answers `{ ok: false, reason }` with the clip unchanged (`data-model.md ClipDescription`; `contracts/agent-surface.md` §1–§3; spec FR-005, FR-007, FR-008, FR-010, FR-018).
- [ ] T025 [US1] Extend `e2e/checks/agent.spec.ts` — recording: with `installStandInShare` in place, the agent's press for the screen source makes the app **ask for a share** and the check reads back that the call carried the person's activation (`askedFor`), then `start_take`/`stop_take` lands a take in the clip. This proves the half a check can hold; the real picker is the user's session (T046) (`e2e/helpers/stand-ins.ts`; `research.md` D2; spec FR-004, FR-005).

**Checkpoint**: US1 is shippable — a person records in the browser the agent opened and gets the clip cut and annotated by talking, watching it happen.

---

## Phase 4: User Story 2 — The agent finishes the job: a file, or a post (Priority: P2)

**Goal**: The surface's output operations and their tools (plan steps 4 and 5's tools).

**Branch**: `feat/agent-surface-out`.

**Independent Test**: After an agent-made edit, ask for an exported file and confirm it holds the edit; ask for a post and confirm it goes out from the person's account, and that without a sign-in nothing leaves the machine.

### Implementation for User Story 2

- [ ] T026 [US2] Have `doExport` in `src/ui/exporting/export-flow.ts` **return** its outcome (`{ kind: 'exported'; bytes } | { kind: 'refused'; reason } | { kind: 'failed'; reason }`) rather than only toasting it, so the surface can answer with what happened. The buttons' behaviour is unchanged.
- [ ] T027 [US2] Create `src/ui/agent/out.ts` — `export(target)` through `doExport` (`data-model.md AgentSurface.out`), and `publish({ text, alt })` through the app's `publishClip`, answering with the post's address; when nobody is signed in (`blueskyAccount()` is null) it returns `{ ok: false, reason }` and publishes nothing (`contracts/agent-surface.md` §2; `research.md` D6; spec FR-006, FR-013, FR-014).
- [ ] T028 [US2] Assemble `out` into `createAgentSurface` in `src/ui/agent/surface.ts` and the gate wiring in `src/main.ts`.
- [ ] T029 [US2] Add `export_clip` and `publish_clip` to `mcp/src/tools.ts` with schemas and dispatch (`data-model.md Tool`; `contracts/mcp-tools.md` §1).
- [ ] T030 [US2] Create `mcp/src/downloads.ts` — take the browser's own download for the export, save it to a path the person is told, and answer `export_clip` with that path and the file's size. The bytes are the browser's, byte for byte, not copied through the protocol (`research.md` D5; `contracts/mcp-tools.md` §1).
- [ ] T031 [P] [US2] Extend the server's node tests: the out tools' schemas and dispatch, and a `publish_clip` with no sign-in refused with a reason and nothing sent (`contracts/mcp-tools.md` §3; spec FR-014).
- [ ] T032 [US2] Extend `e2e/checks/agent.spec.ts` — `export_clip('webm')` produces the browser's download, the check reads it back, and the file holds the cut and the annotation that were made (`research.md` D5; spec FR-006; spec SC-003).
- [ ] T033 [US2] Extend `e2e/checks/agent.spec.ts` — with the Bluesky service stood in for by `page.route`, a publish posts and answers with an address; **without** a sign-in it is refused with a reason and nothing is sent (`research.md` D6; spec FR-013, FR-014).

**Checkpoint**: US1 and US2 both work independently; a clip the agent edited leaves as a file or a post.

---

## Phase 5: User Story 3 — The person stays in control (Priority: P3)

**Goal**: Prove the guarantees (plan step 7's verification). This phase adds no operation: it is what the surface and the server *prove* about themselves.

**Branch**: folded into `feat/agent-surface-record` and `feat/agent-surface-out`, with `docs/agent-final` for the record.

**Independent Test**: Ask the agent to choose what is shared and to publish without a sign-in: the first is the person's in the picker, the second is refused with a reason. Undo every change the agent made, and the clip is back where it started.

### Verification for User Story 3

- [ ] T034 [US3] Extend `e2e/checks/agent.spec.ts` — the gate both ways (a page without the flag publishes nothing at all; one with it publishes the surface), and a change the agent made is taken back by the app's **one undo** in one action, whoever made it (`contracts/agent-surface.md` §1; spec FR-012, FR-017, SC-004).
- [ ] T035 [P] [US3] Node test in `mcp/`: a version mismatch is refused with a reason **before any tool runs**, and the clip is not half-read (`research.md` D7; spec FR-018).
- [ ] T036 [US3] Node test in `mcp/`: no browser can be opened (none installed, or no display) — the person is told plainly and nothing half-starts (`spec.md` Edge Cases).
- [ ] T037 [US3] Record the guarantee in the pull request: the tool list contains no tool that evaluates code, scripts the page, reads or writes a file, or reaches the network except through `publish_clip`; the surface offers the app's own operations and nothing else; and the contract says plainly that the surface is **not** a security sandbox — the promise is about what the server offers, not what the page could be made to do (`contracts/agent-surface.md` §4; `contracts/mcp-tools.md` §1; spec FR-015).
- [ ] T038 [US3] Record that adding the surface changed no existing check's outcome: the full `e2e/` suite is green with **no existing check modified**; if one had to change, name it and say why (spec SC-007; constitution VI).

**Checkpoint**: The promise holds — the picker and the account stay the person's, every change is an ordinary change, and a refusal leaves the clip untouched.

---

## Phase 6: Polish & Cross-Cutting Concerns (branches `feat/mcp-install-release`, `docs/agent-final`)

- [ ] T039 [P] Add the README section on adding the server to a harness (OpenCode first): `opencode mcp add democlip -- npx -y democlip-mcp`, the config block, and the note that a harness may deny `democlip_publish_clip` while every other tool keeps working (`contracts/mcp-tools.md` §4).
- [ ] T040 [P] Add the agent entry to `FEATURES.md`: a session the agent opens, edits in the person's sight, and exports or publishes.
- [ ] T041 [P] Update the module maps: `README.md` (`src/ui/agent/`, `mcp/`) and `.agents/skills/overview/SKILL.md`, to the layout that actually landed.
- [ ] T042 CI and release (plan step 6): add a job to `.github/workflows/ci.yml` that installs and tests the server (`npm --prefix mcp ci && npm --prefix mcp test`), and extend `.github/workflows/deploy.yml` so the same merge that bumps the app stamps `mcp/package.json` with the app's version and publishes the package **with the app's build inside it** — CI owns both versions, and they are the same one (`research.md` D3; spec FR-018; constitution VI).
- [ ] T043 Packaging dry run: `npm run build`, build the server, and pack it locally — confirm the app's build is inside the package, the server runs from the packed copy, and its version equals the app's (`plan.md` step 6).
- [ ] T044 Run the full gate from `package.json`, plus the server's: `npm run lint && npm run typecheck && npx vitest run && npm run build && npm run test:e2e` and `npm --prefix mcp test`.
- [ ] T045 Run `quickstart.md` end to end and paste its output into the pull request, stating which Verification level each part got and what was **not** verified.
- [ ] T046 The real session, by the user (plan step 7): ask the agent to turn the screen source on and choose a window, tab or screen in the browser's own picker — if the press does not carry the activation the picker needs, FR-004 goes back to the source toggle being the person's and the spec is amended rather than the behaviour quietly weakened; and sign in to publish in that window, ask for a post, and look at it. Report both in the pull request (`quickstart.md` §4; `research.md` D2).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies; MUST land first (constitution V).
- **Foundational (Phase 2)**: depends on Phase 1; **blocks** Phases 3–5.
- **US1 (Phase 3)**: depends on Phase 2. No dependency on US2 or US3.
- **US2 (Phase 4)**: depends on Phase 2, and reuses US1's assembled surface (T019) but is independently testable.
- **US3 (Phase 5)**: mostly a *verification* of Phases 2–4; its checks land with the stories they pin.
- **Polish (Phase 6)**: depends on all desired stories; T046 is the user's and closes the plan.

### User Story Dependencies

- **US1 (P1)**: independent after Foundational. The MVP — record in the browser the server opened, and edit it by talking.
- **US2 (P2)**: needs the assembled surface (T019) and the server's dispatch (T012); adds only the out operations and their tools.
- **US3 (P3)**: needs US1 and US2 to exist, because its guarantees are about their operations.

### Within Each User Story

- The rule's test is written with the rule (T007, T013, T020, T023, T031, T035, T036).
- The surface operation before the tool that offers it (T015–T019 before T021; T027 before T029).
- The server's skeleton (T008–T014) before any story's tools.
- The e2e check is written once the operation compiles (T015–T019 before T024).

### Parallel Opportunities

- Phase 1: T001 and T002 (glossary vs skills).
- Phase 2: T004 and T005 (describe vs version); T010, T012 and T013 are different files; T003 before T007.
- Phase 3: T015, T016 and T017 are three files; T020 and T021 are independent; T023 is independent of T021.
- Phase 4: T026 before T027; T031 is independent of T030.
- Phase 5: T035 and T036 (two node tests).
- Phase 6: T039, T040 and T041 (three docs files).

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Different files, no dependency between them:
Task: "Create src/ui/agent/describe.ts — describeClip(clip) — T004"
Task: "Export appVersion() from src/ui/shell/version.ts — T005"
Task: "Create mcp/src/serve.ts — serve the app's build on loopback — T010"
Task: "Create mcp/src/tools.ts — the tool registry — T012"
```

## Parallel Example: Phase 3 (US1)

```bash
# The three operation groups are three files:
Task: "Create src/ui/agent/edit.ts — cut, annotate, setProperty, remove, undo — T015"
Task: "Create src/ui/agent/view.ts — seek, play, pause — T016"
Task: "Create src/ui/agent/takes.ts — takes and sources — T017"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 (the words) → Phase 2 (the gate, the surface, the server) → Phase 3 (edit, view, record).
2. **STOP and VALIDATE**: a person records in the browser the agent opened, gets a cut and an arrow by talking, watches them land, and undoes them with the app's own undo.
3. This is shippable and delivers the thing the feature is.

### Incremental Delivery

1. Phases 1–3 → the session, the recording and the editing (MVP).
2. Phase 4 → the file and the post.
3. Phase 5 → the guarantees proved and recorded.
4. Phase 6 → install, release, the full gate and the user's real session.

---

## Notes

- [P] tasks = different files, no dependency
- [Story] label maps a task to a user story
- The server's tool list grows with each story; a tool never lands before the operation it calls
- No domain rule is added by this feature, so no domain test changes; a domain test that had to change would mean the behaviour changed
- Commit after each task or logical group; stop at a checkpoint to validate a story independently
- **One thing to confirm before Phase 3**: FR-005 says "annotations of every kind", and an image annotation's picture is a file the person chooses. T019 reads that as arrow and text (whose shapes are data) and refuses `image` with a reason. If the agent should also place images, say so and the tool gains a picture source — it is a decision, not a detail.
