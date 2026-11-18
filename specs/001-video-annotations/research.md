# Phase 0 — Research

The decisions the plan rests on, each with what was chosen, why, and what else was
considered. Everything here is grounded in the code that exists today.

## D1 — Where annotations live: the `Clip` aggregate

**Decision**: annotations are held by `Clip` (`src/domain/clip/Clip.ts`), beside the
cuts, as an `AnnotationSet`.

**Rationale**: the aggregate already owns "what the clip is" — the takes and the cuts
— and already holds the rules that relate them (a new take re-bases the cuts because
they are fractions of a growing clip; the kept stretches are what an export is made
of). Annotations have exactly those properties: they are fractions of the clip, they
must survive a new take, and they are drawn into the export. Putting them anywhere
else would mean a second owner of the same facts, which is the thing the aggregate
exists to prevent.

**Alternatives considered**: a separate `AnnotationTrack` object beside the clip —
rejected, it would need its own copy of the total/kept-time mapping and would drift
from the clip's; view state in `app` — rejected, they are not the view's, they are
the clip's and must be persisted and exported.

## D2 — How a kind is made extensible: a subclass, and a renderer

**Decision**: an annotation is a **class**. `Annotation` is the abstract base, and a
kind is a subclass of it — the arrow is `Arrow`. The base holds what every annotation
has: identity, the stretch it is shown over, and the pure geometry a drag and a pick
are made of (`handles`, `withHandle`, `movedBy`, `withSpan`, `hitTest`). A kind adds
its own shape and the rules for it (`Arrow.create` normalises, `isUsable` refuses a
stray click, `stored`/`restore` write it down and read it back). **The class is the
kind**: its static `id` names it and its static `restore` rebuilds one, which is what
`src/domain/annotation/kinds.ts` registers so a stored clip can be opened again.

How it *looks* is the one thing that stays out. A **renderer**
(`src/ui/annotation-layer.ts`) is registered under the same id and does nothing but
draw. That is not a compromise: `src/domain/` may not touch a canvas, for the same
reason `TakeRepository` is a port.

**Rationale**: a concept with rules is a class in this repository — `Span`,
`SpanSet`, `Clip` — and the arrow's rules are real rules: it has ends to take hold
of, it can be aimed and moved, and it knows how close a point has to be to be on it.
Keeping them on the class puts them with the thing they are about, and makes the
view's drag polymorphic (`annotation.movedBy(...)`, `annotation.withHandle(...)`)
instead of a shape the view has to know. Adding a kind is a class beside `Arrow`, a
line in the register, and a renderer.

**Alternatives considered**: an interface plus a kind-descriptor object (the first
cut of this change) — rejected, it split the rules from the type and left the view
reconstructing geometry by hand; a class with a `draw(ctx)` method — rejected, it
would make the domain import a canvas; an `instanceof` switch in the view instead of
a renderer registry — rejected, adding a kind would then edit the drawing code.

## D3 — Units and anchoring: fractions of the picture and of the clip

**Decision**: a geometry is held in **fractions of the picture** (`[0, 1]²`), and a
span in **fractions of the clip** (`[0, 1]`), exactly as the crop region and the cuts
are held today.

**Rationale**: fractions are what make the same annotation land in the same place on
the preview canvas, on the export canvas (which can be a different size — an odd crop
is taken down to even for H.264, `ExportSpec.picture`), and after a reload. The cuts
already use clip fractions and are re-based when a take is added; a span stored the
same way inherits that behaviour (FR-004, SC-003).

**Alternatives considered**: pixels — rejected, the preview, the export and the
recorded picture are three different sizes; seconds — rejected for the geometry (it
is spatial) and unnecessary for the span (fractions already work for the cuts).

## D4 — The generic selection: extract the section, then choose the action

**Decision**: the pending section that `ui/marks.ts` owns today (the two marks and
`pendingSection()`) is extracted into `ui/selection.ts`, which exposes the current
section and the marks. The Cut action and the new Annotate action both read it. The
section's overlay gains an **Annotate** action beside the scissors; the documented
"click inside the section to cut" shortcut stays.

**Rationale**: this is the user's own direction and it is the smallest honest change —
the selection stops meaning "a cut" and starts meaning "a stretch the user is
pointing at", which the action then consumes (FR-013). Nothing about *making* the
selection changes, so the marks' click, drag and nudge behaviour is untouched.

**Alternatives considered**: a second, annotation-only selection mechanism — rejected,
it would duplicate the marks, the drag and the nudge, and give the user two ways to do
one thing; making the whole `marks.ts` module generic — rejected as more churn than
the change needs.

## D5 — One layer, drawn by playback and by the export

**Decision**: a single module, `ui/annotation-layer.ts`, paints every annotation
active at a given moment onto a 2-D context, in fractions of that context's size.
`ui/playback.ts` calls it each frame after `drawClipFrame`; `offline-export.ts` calls
it on its own export canvas after `frame.draw(...)` and before `video.add(at, ...)`.

**Rationale**: FR-006 and SC-002 require the file to match the review, and the only
way to be sure of that is for both to run the same code. The export already draws on
its own canvas (`ec`), separate from the preview (`el.cv`), and already copies `ec`
to the preview for the progress view — so a renderer that works in fractions drops
into both without either learning about the other.

**Alternatives considered**: draw annotations onto the recorded frames — rejected, the
recording is never re-encoded (FR-012); a second renderer for the export — rejected,
two implementations of "what an arrow looks like" will drift.

## D6 — Persistence: the clip snapshot's small half

**Decision**: `ClipSnapshot` gains `annotations`, and the clip store's `Meta` record
gains an `annotations` array. A change to an annotation goes through the existing
`saveMeta` path (`resume.ts` already schedules it for any non-take event).

**Rationale**: an annotation is a few numbers — like a cut — so it belongs in the
small half that is written on every change, never with the recording, which is
megabytes and written once. This is exactly the split `clip-store.ts` was built for,
and it is why a change writes bytes rather than re-writing the take.

**Alternatives considered**: a third object store — rejected, the annotations are as
small as the cuts and move as often; `localStorage` — rejected, it holds a string and
would fragment the clip's one record.

## D7 — Undo: one `lastChange` on the clip

**Decision**: replace `Clip`'s cut-specific `lastApproved` with a single
`lastChange` that is one of: a cut approved, an annotation added, an annotation
removed, or an annotation changed (carrying what it was). `canUndo()` and `undo()`
work on it, and `undo()` reports what it reversed so the header can show it.

**Rationale**: FR-015 asks for the one undo the user has to take back whatever they
last did. Today's `lastApproved` is the right shape — "what changed, and how to put
it back" — it is only cut-shaped; widening it to a union keeps one code path and one
button.

**Alternatives considered**: a stack of changes (multi-step undo) — rejected as more
scope than the spec asks; separate undo per kind — rejected, it is not what the user
chose in clarification Q1.

## D8 — A cut takes its part of an annotation's stretch

**Decision**: an annotation's span is kept in the recording's own fractions, and
whether it is *shown* at a moment is decided through the clip's `TimelineMap`, the
same mapping playback and the export already use. An annotation whose kept stretch is
empty is not drawn.

**Rationale**: FR-014 falls out of the existing mapping rather than needing a rule of
its own — a moment inside a cut is not on the timeline, so nothing is drawn there.
This is the same mechanism the playhead and the strip use.

**Alternatives considered**: shortening the stored span when a cut is approved —
rejected, it would rewrite the user's data and make undo ambiguous (put the cut back —
where does the annotation end now?).

## D9 — Events: the clip announces the change

**Decision**: add `annotation-added`, `annotation-changed` and `annotation-removed`
to `ClipEvent`. The layer, the timeline lane and the marks react to them, as they
already react to `cut-approved` / `cut-undone`.

**Rationale**: the repository's rule is that the view listens; nothing re-renders
because it happened to be the caller, and the reaction never runs inside the
announcement. The persistence flow (`resume.ts`) also hangs off these events, so
annotations are written without a caller asking.

**Alternatives considered**: one `annotations-changed` event — rejected, the existing
events are specific (`take-added`, `cut-approved`) and listeners want to know which.

## D10 — The timeline lane

**Decision**: a new overlay element in the timeline (`#tl-annots`, beside `#tl-marks`)
shows each annotation's kept stretch as a small bar, mapped through `keptOf` /
`keptLengthNow` exactly as the marks are. Clicking a bar selects that annotation and
moves the playhead to it.

**Rationale**: FR-016 and SC-007 — an annotation is invisible outside its stretch, so
the timeline has to show where it is. The marks overlay is the pattern: an absolutely
positioned layer over the strip, laid out in timeline (kept) time.

**Alternatives considered**: reusing the thumbnail strip's cells — rejected, the strip
is pictures, not controls; a separate timeline row — rejected as more layout than the
change needs (a lane over the existing strip is enough).

## D11 — The arrow's look

**Decision**: one style, defined once in `ui/annotation-layer.ts`: a straight shaft
with a solid head, in the app's accent colour, stroked with a thin dark outline so it
stays legible over both light and dark pictures. No per-arrow style editor.

**Rationale**: the spec's assumption is one look for the first change (FR-011 is about
the *family*, not styling). A single constant is a one-line change later; an outline
is what keeps a coloured arrow visible over an unknown screen.

**Alternatives considered**: a colour per annotation — deferred, not in this spec; no
outline — rejected, an arrow disappears over a same-coloured screen.

## D12 — What is proven how

**Decision**:
- the rules — `AnnotationSet` (identity, add/change/remove), the arrow kind
  (normalise, usable), and `Clip` (annotations, one undo, cuts, snapshot/restore,
  re-base on a new take) — by **unit tests in node**;
- the layer, the lane, the picture gesture, and the export — by a **browser
  harness** on the dev server, asserting what a person would see;
- the recorder's flow is untouched, so no real-session check is needed for it.

**Rationale**: the Verification skill's rule — a rule in `domain/` is proved by a unit
test, anything drawn, played or encoded by a harness. The export's own half is already
browser-only and is checked the same way the existing export harnesses are.

**Alternatives considered**: unit-testing the drawing with a fake context — rejected,
the skill is explicit that what a person sees is asserted in a harness, and the
existing `drawImage`/`globalAlpha` instrumentation is the established way.
