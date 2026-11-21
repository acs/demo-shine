# Phase 0 — Research

The decisions the plan rests on, each with what was chosen, why, and what else was
considered. Grounded in the code as it stands: the four layers, the `web/` shell, and the
committed end-to-end suite in `e2e/`.

## D1 — The app offers a surface, deliberately and only when asked

**Decision**: the app gains `src/ui/agent/surface.ts` — one object holding the app's
operations — and `main.ts` publishes it on the page (`window.democlip`) **only** when the
page was opened asking for it (`?agent=1`). A page without the flag carries nothing.

**Rationale**: the surface drives the app's own flows, so it belongs in `ui/`, where the
view's business lives, and it must be a thin caller of them rather than a second editor
(Domain model skill: a rule lives in one place). Gating it keeps the app's promise that a
normal page is just the app: a capability that can record and publish is one a page
should have to ask for, and a person opening DemoClip should not be carrying it. It also
gives the end-to-end suite a person-visible way to prove both states — with the flag, and
without.

**Alternatives considered**: reaching the app's modules from outside, as the suite does
today through the dev server's `/@fs/` URLs — rejected for the server, because a released
package serves the app's **build**, where those URLs do not exist; an always-on surface —
rejected, it changes what every page is; driving the app's UI instead (D2).

## D2 — The agent presses with real input events; it does everything else through the surface

**Decision**: two channels, chosen per operation. Anything that needs the person's
**activation** — turning the screen source on, which opens the share picker — is done by a
real input event (a trusted click the server delivers to the browser). Everything else —
cutting, annotating, properties, undo, seeking, exporting, publishing — goes through the
surface, which calls the app's own operations directly.

**Rationale**: the browser only opens the share picker for a *transient user activation*,
and a scripted `element.click()` does not carry one while a trusted input event does. So
the one operation that is the browser's to gate is delivered the way a hand would. The
rest has no reason to go through the picture at all: driving a `<canvas>` by coordinates
would be brittle, slow and invisible to a check, and the app already has the operations.

**Alternatives considered**: driving the whole UI — rejected (canvas coordinates,
gestures, and a check cannot assert on it); the surface doing the picker too — rejected,
it cannot carry activation; the server launching the browser with a flag that skips the
picker — rejected, that would choose what is shared for the person, which the spec
forbids (FR-004).

## D3 — The server owns a headful browser, and serves the app's own build

**Decision**: the server launches a browser **headful**, on a **profile of its own**, and
serves the app's build from its own package on loopback (`http://127.0.0.1:<port>`). The
person records in that window; the server drives the same page.

**Rationale**: headful is the feature — the person watches the edits (spec US1, FR-011) —
so a headless browser is the other mode, not this one. A profile of its own keeps the
person's everyday browser untouched and gives the publishing sign-in a home. Loopback is a
**secure context**, which is what screen capture requires, so capture works with no
certificate and no deployment; and serving the build the server was released with is what
makes "the two agree on how a clip is written down" true by construction rather than by a
promise (spec FR-018).

**Alternatives considered**: loading the deployed app — rejected as the default, because
it makes the version a question (a newer deployment, an older server) and needs the
network for a feature whose promise is local; attaching to a browser the person already
has — rejected, because Chrome only exposes the debugging port if it was *started* with
it, and a second instance on the real profile is refused; a browser extension — deferred,
it is the only way to reach the person's own logged-in browser, and it is more to build
than this version needs.

## D4 — The tools are the app's operations, named in its words

**Decision**: one tool per operation the app has, named after it — record a take, cut a
stretch, add an annotation, change a property, remove an annotation, undo, seek, export,
publish, and one to describe the clip. No tool evaluates code, and no tool reaches outside
the clip.

**Rationale**: spec FR-015 and FR-016 — the agent's reach is the app's operations, and a
person reading the chat recognises what was done. It also keeps the surface honest: what
the server can do is exactly what the surface publishes, so the two lists cannot drift
apart. A general "run this in the page" tool would be smaller to write and would make
every guarantee here unprovable.

**Alternatives considered**: a generic call tool with an operation name and arguments —
rejected, the schema would then describe nothing and the refusals would be strings; a
tool per UI gesture — rejected, gestures are not operations.

## D5 — The exported file comes back as a download

**Decision**: an export is asked for through the surface, and the file the app writes is
taken by the server as the browser's own download, saved to a path the person is told.

**Rationale**: the app already ends an export in a download (`DownloadPort`), so nothing
in the app changes; the browser gives the server the finished file, byte for byte, which
is the same file a person would have got. Reading the blob out of the page instead would
copy a large file through the protocol for no reason.

**Alternatives considered**: reading the blob and writing it from the server — rejected,
it doubles the work for the same bytes; a path passed into the page — rejected, the page
cannot write to the person's disk.

## D6 — Publishing reuses the app's flow, and a refusal is a reason

**Decision**: the publish operation calls the app's own publishing flow. When nobody is
signed in, it returns a reason and publishes nothing. The sign-in is the person's, done
once in that window, as it is today.

**Rationale**: spec FR-013, FR-014 — nothing leaves the machine unless the person asked,
and the account is theirs. Reusing the flow keeps the Bluesky limits, the aspect ratio and
the post shape in one place. The person's OAuth session lives in the browser profile the
server owns, which is what makes the sign-in a one-time thing.

**Alternatives considered**: the server holding its own token store — rejected, it would
be a second sign-in and a second place a token lives; publishing from the server with a
token the person pastes — rejected, it puts a credential in a chat.

## D7 — The version is checked, not assumed

**Decision**: the surface reports the app's version; the server carries the version it was
released with and refuses to drive a page that does not match, with a reason.

**Rationale**: spec FR-018. Serving the app's own build makes a mismatch unlikely, but
"unlikely" is not "cannot": a person can point the server at a dev server, or at a
deployment. A check that refuses is a sentence; half-reading a clip is a bug hunt.

**Alternatives considered**: trusting the build — rejected, the one case it fails is the
one that is hardest to diagnose; making the surface tolerant of older shapes — deferred,
it is the app's persistence problem and not this feature's.

## D8 — One clip, one session, two hands

**Decision**: one browser, one clip, one agent at a time. The person and the agent share
the clip exactly as the app already shares it: a change announces, the last change wins,
and the app's one undo takes back the last change of any kind, whoever made it. There is
no lock and no group (spec Q1, Q2).

**Rationale**: the app's rules are the app's rules; an agent is another hand, not another
kind of change. A group would be a real change to the clip's undo — a core rule — and the
clarified answer is that each change is taken back on its own. A lock would be new
machinery for a case ("we are both editing this instant") that a person avoids by handing
over.

**Alternatives considered**: a group per instruction — rejected by the clarified answer;
a lock while the agent works — rejected as machinery for a rare case; two clips at once —
deferred.

## D9 — What is proved how

**Decision**:
- the surface's own rules (what it refuses, what it reports) and the server's (the tool
  list, the refusals, the version check) — by **unit tests in node** beside them;
- the surface end to end, the export's file and a refused publish — by **committed checks
  in `e2e/`**, driving the real app in a browser, including one that proves a page without
  the flag has no surface;
- the agent's press opening the **share picker**, and a **real publish** to a real account
  — by a **real session, by the user**, because no check can open a picker or hold
  someone's account.

**Rationale**: the Verification skill's three levels, as they now stand. The recorder's
row is explicit: `getDisplayMedia` needs a gesture and a picker, so no check opens a
share; the suite covers everything *after* a share is handed back, which is exactly where
the surface's recording operations live. The one thing a check *can* prove about the
picker is the half that would otherwise be a guess — that the press the agent delivers
carries the activation the browser requires — and it does that with the stand-in share in
place, asserting what the app asked for and with what activation.

**Alternatives considered**: a temporary harness — retired by the project in favour of the
committed suite (Verification skill); driving the server itself from a check — kept, but
small: one integration check that starts it and calls a tool, with the rest of the
server's behaviour proved in node.