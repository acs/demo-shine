# Feature Specification: Hexagonal Shared Modules

**Feature Branch**: `refactor/hexagonal-shared-modules`

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "We have shared files in the project like recorder.ts, exporter.ts, publisher.ts, session.ts, offline-export.ts, resume.ts or state.ts that are outside our DDD/hexagonal modelling. The goal of this spec is to refactor them to follow the DDD/Hexagonal architecture."

## Clarifications

### Session 2026-11-19

- Q: Is the seven-module list the full scope of this refactor, or should other root-level modules be included? → A: The seven named modules only.
- Q: Should `state.ts` be eliminated, or may it remain as the single owner of the phase? → A: Keep it as a slim module that owns only the phase and its change event.
- Q: Should the refactor keep the existing layer folders, or introduce explicit `ports/` and `adapters/` folders? → A: Keep the existing layer folders; ports sit beside the use cases and adapters stay in the browser boundary.
- Q: What counts as "behaviour-preserving" for this refactor? → A: User-visible outcomes only; internal ordering and timing may change, but the person sees the same screens, actions and results.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A rule is proved without a browser (Priority: P1)

A maintainer changes how a clip is recorded, exported, published or kept across a reload. The rule that decides the behaviour lives in a module that runs without a browser, and a unit test beside it proves the rule with fakes standing in for the browser. The maintainer runs the suite in a terminal and sees the rule pass or fail before opening the app.

**Why this priority**: The behaviour that lives in the shared modules can only be checked today by running the app — often by recording a real screen share. Moving that behaviour where a unit test can reach it is the value of the whole refactor; every other story supports it.

**Independent Test**: Change one rule in each of the seven shared modules' areas — recording, export, publish, keeping and restoring, ending a session — and run the unit suite with no browser and no dev server. Each change is caught by a test beside the rule.

**Acceptance Scenarios**:

1. **Given** a rule about what a clip exports, **When** a maintainer runs the unit tests in a terminal with no browser, **Then** the rule's behaviour is proved without a running app.
2. **Given** a use case — record a take, export a clip, publish a clip, keep a clip, restore a clip — **When** its browser collaborators are replaced by fakes, **Then** the use case runs to completion in a terminal.
3. **Given** the refactor, **When** the existing unit tests are run, **Then** they pass without being rewritten; a test that must change is a deliberate behaviour change and is said out loud.

---

### User Story 2 - A browser capability can be swapped for a fake (Priority: P1)

A maintainer needs to prove a flow without a screen share, a real encoder, a real store or a real network. Each browser capability the shared modules depend on is named by a port, and an adapter in the browser boundary implements it. A test or a harness can put a fake behind the port and drive the same use case.

**Why this priority**: A port is what makes the first story possible and what keeps the rules from leaking back into the browser. It is the structural half of the same value.

**Independent Test**: Replace the display capture, the recorder, the encoder, the clip store and the Bluesky client with fakes, one at a time, and run the matching use case end to end in a terminal.

**Acceptance Scenarios**:

1. **Given** a use case that needs a browser capability, **When** a fake adapter is put behind its port, **Then** the use case runs without the real capability.
2. **Given** a browser capability is replaced, **When** the change is made, **Then** no rule in the domain or the use cases changes.
3. **Given** a module in the domain or the use cases, **When** its imports are read, **Then** it imports neither the view nor a browser adapter.

---

### User Story 3 - A flow only sequences (Priority: P2)

A maintainer opens the code behind a button — Record, Export, Publish or New — and reads a sequence of browser work and a report of the outcome. The rules the button depends on are in the use case it calls, not in the handler. When a rule changes, the handler does not.

**Why this priority**: The flows are where browser sequencing belongs, and where rules currently hide. Separating the two is what stops the rules from drifting back into the buttons.

**Independent Test**: Read each flow and point every decision it makes to the use case that owns it; replace a use case's outcome with a different value and see the flow report it without changing any rule.

**Acceptance Scenarios**:

1. **Given** a person presses a button, **When** the flow runs, **Then** the sequence of browser work is visible in one place and the rules are not.
2. **Given** a use case returns an outcome, **When** the flow reports it, **Then** the status line and the phase follow from the outcome, not from a second copy of the rule.
3. **Given** a browser cannot do the work — no encoder, no share — **When** the flow runs, **Then** it refuses before starting and says why, as it does today.

---

### User Story 4 - The view listens, and the session ends itself (Priority: P2)

A person ends a session — New, an export, a publish, or a share that went away — and every view lets go of the clip. A maintainer adds a view later and does not edit a central list of things to reset. Views update because the clip announced a change, not because a caller remembered to re-render them.

**Why this priority**: The session and the shared state are the last place where the app knows every view by name. Making the view listen is what lets the shared state shrink and the session stop being a registry.

**Independent Test**: Add a view that draws one more thing about the clip; end a session; the new view resets itself without a change to the session. Then run New, an export and a lost share and confirm each ends the same way.

**Acceptance Scenarios**:

1. **Given** a clip announces a change, **When** the change concerns a view, **Then** that view reacts without its caller re-rendering it.
2. **Given** a session ends, **When** the event is announced, **Then** every view ends its own lifetime and nothing is left holding the clip.
3. **Given** a new view is added, **When** a session ends, **Then** the new view ends with it without the session being edited.
4. **Given** a session ends while an export or a publish is in flight, **When** the event is announced, **Then** the work in flight is not cut in half by a view reset.

---

### User Story 5 - The seven shared modules have a home (Priority: P3)

After the refactor, no module at the repository root holds a rule or a piece of browser work that belongs to a layer. The seven shared modules are gone or reduced to the composition root and the slim phase module; the map in the documentation names where each kind of code lives, and a newcomer can find the rule behind a behaviour without reading the whole tree.

**Why this priority**: It is the completion of the refactor and the proof that nothing was left behind. It delivers no behaviour on its own.

**Independent Test**: Walk the module map and find each of the seven modules' responsibilities in its layer; confirm no root module remains outside the composition root and the phase module.

**Acceptance Scenarios**:

1. **Given** the refactor is finished, **When** the repository root is read, **Then** no module there holds a rule or a browser adapter; only the composition root and the phase module remain.
2. **Given** a behaviour, **When** a newcomer follows the map, **Then** the map leads to the layer and the module that owns it.
3. **Given** a new concept is introduced by the refactor, **When** it is named, **Then** the word is in the glossary before it appears in the code.
4. **Given** a change is merged, **When** the version is read, **Then** CI bumped it and no one changed it by hand.

### Edge Cases

- A change crosses two layers — the clip announces a take was added and the view draws it — and the view must not render a half-updated clip.
- A restore announces nothing: it is a load, not a change, so the flow that opens the review must set every view up.
- The share ends while a take is recording: the take must still be kept and the session must end cleanly.
- A session ends while an export or a publish is in flight: the work must not be cancelled by a view reset, and the outcome must still be reported.
- A browser without the encoder: the refusal must survive the move, and the person must be told before anything is written.
- A clip store write fails before a sign-in: the sign-in must be refused so the recording is not lost.
- The encoder's progress is drawn on the preview: moving the preview out of the adapter must not stop the preview from moving.
- A port has two adapters — the download's container and the published one; the use case must not know which.
- A port is added for a capability that is not there in every browser: the use case must still run, and the flow must say what is missing.
- The recorder's real screen share cannot be started by a harness: the gap is stated, not hidden.
- A view is added after the refactor: the session must not need a new line.
- A shared piece of state is genuinely shared — the phase — and must not be copied into every view.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every rule held today by the seven shared modules MUST move to a module that runs without a browser.
- **FR-002**: No module in the domain or the use cases MUST import the view, a browser adapter, or a browser API.
- **FR-003**: Every browser capability the shared modules use MUST be named by a port and implemented by an adapter in the browser boundary.
- **FR-004**: The ports MUST cover, at least: display capture, webcam, microphone, take recording, video encoding, clip storage, the Bluesky client, and time.
- **FR-005**: Each use case MUST run end to end in a terminal with fakes behind its ports.
- **FR-006**: The flows MUST only sequence browser work and report outcomes; they MUST NOT contain a rule.
- **FR-007**: A use case MUST return an outcome value that lets the flow report what happened without re-deriving the rule.
- **FR-008**: The clip MUST remain the only owner of what the clip is; the shared state MUST NOT duplicate or shadow its rules.
- **FR-009**: View state MUST be owned by the view module that owns the widget; the shared state MUST NOT hold it.
- **FR-010**: A browser resource MUST be owned and released by the adapter that acquired it.
- **FR-011**: The phase MUST have one owner and one change event; the views MUST follow it.
- **FR-012**: Ending a session MUST be one event; each view MUST end its own lifetime in response.
- **FR-013**: A new view MUST be addable without editing a central reset list.
- **FR-014**: The export use case MUST decide what to write and return the plan; the encoder adapter MUST only encode it.
- **FR-015**: The encoder adapter MUST NOT import or draw the view; progress MUST be reported as a value and drawn by the view.
- **FR-016**: The publish use case MUST keep the clip before sending the person to sign in, and MUST let the kept copy go after a successful publish; a failed keep MUST refuse the sign-in.
- **FR-017**: The restore use case MUST rebuild a stored clip without announcing a change; the flow MUST open the review on it.
- **FR-018**: The record use case MUST own the sequence of a take — sources, mix, record, stop, take added — and MUST NOT draw.
- **FR-019**: The existing unit tests MUST pass unmodified; a test that must change MUST be a deliberate behaviour change, stated in the change.
- **FR-020**: The refactor MUST NOT change what a person sees or can do: the same sources, the same recording, the same review, the same export, the same publish, the same restore.
- **FR-021**: The refactor MUST be delivered as a sequence of steps, each leaving the app working and each its own pull request.
- **FR-022**: The documents that own the map — the README, the glossary and the skills — MUST be updated to match; a new concept MUST be named in the glossary before it appears in the code.
- **FR-023**: Anything drawn, played or encoded MUST be proved by a temporary browser harness, and the recorder's real share MUST be run by the user; the gap MUST be stated.
- **FR-024**: The version MUST NOT be bumped by hand; CI owns it.

### Key Entities

- **Clip**: the aggregate — the takes and the cuts, with the length derived from them. It stays the only owner of what the clip is.
- **Session**: one sitting of the app — the clip and the view state that belongs to showing it. It ends on one event: New, an export, a publish, or a share that went away.
- **Take**: one press of Record: the recording bytes and their length.
- **Phase**: the session's state — idle, starting, live, recording, review, encoding. It has one owner and one change event.
- **Port**: a named browser capability a use case needs, described without the browser.
- **Adapter**: the implementation of a port in the browser boundary — capture, recorder, encoder, store, client, clock.
- **Use case**: a sequence that delivers an outcome — record a take, export a clip, publish a clip, keep a clip, restore a clip.
- **Flow**: the composition of a use case with the view and the browser — the button, the status line, the phase, and the sequencing.
- **Shared module**: each of the seven modules in scope, and the responsibility it holds today:

| Shared module | What it holds today | The layer that owns it |
|---|---|---|
| `recorder.ts` | Source acquisition, the take's canvas and audio graph, the recorder's lifecycle, and the review's opening | The record use case, its ports and adapters, and the view |
| `exporter.ts` | The export flow, its refusal, its controls, and the end of the session | The export use case and the flow |
| `publisher.ts` | The publish flow, the sign-in, and the wiring of the Bluesky client | The publish use case and the flow |
| `session.ts` | The reset of every view's state | The session and the views |
| `offline-export.ts` | The browser encoder, which also draws the preview and the annotations | The encoder adapter and the view |
| `resume.ts` | Watching the clip, writing it down, restoring it, and opening the review | The keep and restore use cases and the flow |
| `state.ts` | The shared mutable state: the clip, the phase, the browser resources, and the view state | The clip, the session, the view, the adapters and the phase |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the rules held by the seven shared modules are proved by unit tests that run without a browser; the count of rules without a test is zero.
- **SC-002**: Each use case runs end to end in a terminal with fakes in under one second.
- **SC-003**: Zero modules in the domain or the use cases import the view or a browser adapter.
- **SC-004**: A new view can be added with no change to the session; the diff shows no new line in the session's code.
- **SC-005**: 100% of the existing unit tests pass without being rewritten.
- **SC-006**: 100% of the existing acceptance scenarios still pass — the same sources, recording, review, export, publish and restore.
- **SC-007**: The seven shared modules are gone from the repository root or reduced to the composition root and the phase module; the map names every layer.
- **SC-008**: A newcomer can locate the rule behind a named behaviour in under two minutes using the map.
- **SC-009**: Every step ships as its own pull request and the app works after each; no step leaves a broken build.
- **SC-010**: The recorder's real-share gap is stated in every change that touches it; no change claims a share was run when it was not.

## Assumptions

- The refactor is behaviour-preserving in what a person sees and can do. No feature changes; the annotations, the cuts, the export and the publish all keep working as they do, while internal ordering and timing may change.
- The refactor does not set a new performance target: the app's existing speed is the baseline, and a slowdown a person would notice counts as a regression.
- Some of the seven modules are already partly modelled — the export plan and the publish use case live in the application layer — and the refactor finishes the move rather than starting it.
- The seven named modules are the full scope; the list is exhaustive for this refactor. Other root modules — the composition root, the preferences and the small utilities — are out of scope except as wiring.
- The existing layer names stay: domain, application, infrastructure and view. "Hexagonal" means the direction of dependencies and the ports, not a new folder tree; no new top-level `ports/` or `adapters/` folders are added.
- A port lives beside the use case that needs it; an adapter lives in the browser boundary. The existing `TakeRepository` and `BlueskyService` are the pattern.
- The shared state shrinks to a small module that owns only the phase and its change event; it must not hold a rule or view state.
- The refactor is delivered as a sequence of steps, one pull request each, in an order that keeps the app working. The steps are decided in the plan, not here.
- The recorder's real screen share cannot be automated; the user runs it, and the change says so.
- The export stays offline and the publish stays on Bluesky; no new output, no new network.
- The proof is the old tests passing unmodified, a browser harness for what is drawn, played or encoded, and a real session for the share.
- The version is CI's; the refactor does not bump it.
