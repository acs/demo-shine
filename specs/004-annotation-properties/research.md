# Phase 0 — Research

The decisions the plan rests on, each with what was chosen, why, and what else was
considered. Grounded in the code as it stands after the plugin seam
(`specs/003-annotation-plugins/`) and the text kind.

## D1 — A property is declared by the kind, and the inspector asks

**Decision**: `AnnotationPlugin` gains an optional `properties` list. Each entry is an
`AnnotationProperty`: an id, a label, which shared control edits it (`colour` or `text`),
how to read its value off an annotation, and the same annotation with a new value. The
inspector reads the picked annotation's kind, asks its plugin for the list, and renders
those controls. It names no kind and has no `switch`.

**Rationale**: this is the same seam the kinds already rest on — a kind is a class, a
renderer and a plugin, registered by id — and it is the only shape that satisfies the
spec's FR-006 and FR-007: adding a property to a kind, or a kind with properties, must
not touch the inspector or the other kinds. The inspector knowing "colour" and "text"
as *controls* is fine; it knowing which kinds have them is not.

**Alternatives considered**: a per-kind inspector — rejected, it is the thing the
plugin seam exists to avoid; a `switch` on `annotation.kind` in the inspector —
rejected, it moves the per-kind edit back into the shared module; putting the property
list on the domain class — rejected, a property is an editing affordance, and
`src/domain/` may not own the view's controls.

## D2 — The value lives with the annotation, in its geometry

**Decision**: a property's value is part of the annotation and is carried in the kind's
geometry — `ArrowGeometry` and `TextGeometry` each gain a colour; the text's words are
already there. The stored shape gains the field, and `restore` tolerates its absence.

**Rationale**: the spec's FR-004 requires the value to be kept with the clip, and every
other part of an annotation (its span, its shape) already lives in its geometry, is
written by `stored()`, read by `restore()` and carried by `withSpan`/`duplicated`. A
value kept anywhere else would need its own storage and its own way to follow a copy.
It also keeps `src/domain/` pure: a colour is a string on a value object, not a DOM
thing.

**Alternatives considered**: a shared `style` on the base `Annotation` — rejected for
this version: it would force every kind's factory and every derived operation to thread
a field the image does not use, for a property only two kinds have; a side table keyed
by annotation id — rejected, it is a second owner of the clip's facts, the thing the
aggregate exists to prevent.

## D3 — One colour rule, a default per kind, a fixed palette

**Decision**: `AnnotationColour.ts` holds the palette (one list, six colours chosen to
read over a light and a dark picture), `colourOf(value, fallback)` which accepts a
palette colour and otherwise falls back, and the type. Each kind picks its own default —
the arrow's accent red, the text's white — and its `create` normalises a colour through
`colourOf`.

**Rationale**: the rule — which values are colours, and what an unknown one becomes —
is one rule, so it lives in one place; the *default* is a kind's choice, because an
arrow on a screen and a line of text want different ones. A fixed palette satisfies the
spec's assumption and means every colour a user can pick is one the renderers' outlines
keep legible.

**Alternatives considered**: a free colour picker — rejected by the spec's assumption
(any colour can vanish over a matching screen, and the kinds' outlines are tuned for the
palette); a colour on the base with one default — rejected, the arrow and the text need
different defaults and the image needs none; storing a raw string with no validation —
rejected, a damaged stored clip would paint with `undefined`.

## D4 — Re-wording a text: the rule in the domain, the measuring in the view

**Decision**: `TextAnnotation.withWords(words, measuredWidth)` takes the **width the new
words measure at the annotation's current font size**, as a number, and returns the same
text with the new words. It keeps the anchor and the font size, widens the box to that
width, and only when the width would run past the picture from the anchor does it shrink
both by one factor until it fits. The view measures — `CanvasRenderingContext2D.measureText`
with the same font the renderer draws — and hands the number in.

**Rationale**: the clarified answer (Q2) is "size stays, box follows, shrink only to
fit", and that is a rule about the annotation, so it belongs on the class and is proved
in node by handing in widths. The domain cannot measure text (no canvas, Principle II),
and it does not need to: the one thing it lacks is a number the view can supply. The
anchor held is what makes FR-012's "without changing its place" true even when the box
grows.

**Alternatives considered**: measuring in the domain through a port — rejected, it is a
canvas question with one caller and would put a port where a number suffices; growing
the box and letting `create` clamp it inside — rejected, it moves the text, which the
spec forbids; wrapping into lines — rejected for this version (the spec's edge case says
it is not wrapped).

## D5 — A property change is `clip.changeAnnotation`

**Decision**: the inspector applies a change by calling
`session.clip.changeAnnotation(id, next)` with the annotation the descriptor returned.
It does not add its own undo, its own event or its own save path.

**Rationale**: the clip already announces `annotation-changed`, the views already
listen, the one undo already holds the previous annotation, and the keep flow already
writes the small half on any change. The spec's FR-010 asks for exactly this — a
property change is not a second kind of change — and the project's rule is that a rule
lives in one place. A property change then behaves like a resize for free: shown at
once, undone once, kept across a reload.

**Alternatives considered**: a separate `setProperty` on the clip — rejected, it is the
same change wearing a second name; writing the store directly from the inspector —
rejected, it bypasses the flow that debounces and reports.

## D6 — A settings control on the picked annotation, and a popover placed like the camera menu

**Decision**: the layer draws a third control on the picked annotation — a gear — beside
the × and the copy, from the same `handles()` geometry the other two use. The canvas
hit-tests it, and pressing it opens a body-level popover. The popover is positioned in
viewport coordinates from the annotation's box and clamped, with outside-click, Escape
and resize closing it — the pattern `ui/recording/camera-menu.ts` already uses.

**Rationale**: the clarified answer (Q1) chose a control over opening on every pick, so
moving an annotation never covers the picture. The two existing controls already live
off the annotation's middle precisely so a press on one cannot be a press that aims; a
third on the same geometry keeps that guarantee. A body-level element cannot be clipped
by the preview and is what the app's other menus do.

**Alternatives considered**: opening on pick — rejected by Q1; a panel in a corner of
the preview — rejected, it is further from the thing being changed and needs its own
region; a control inside the timeline lane — rejected, the lane is a finder and the
annotation may be off-screen in time; a modal dialog — rejected, the change should be
seen as it is made.

## D7 — One in-app text entry, for entering and for editing

**Decision**: `ui/annotating/text-entry.ts` is a small body-level dialog — an input,
Cancel and Add, Enter to confirm, Escape to cancel, the input focused — used by the text
plugin's `begin` **and** by the inspector's words row. The browser `prompt` is removed.

**Rationale**: the spec (FR-013) forbids the platform prompt and the text kind's own
todo records it; using one entry for both satisfying "entering and editing use the same
control" with one component. Confirm-on-Enter is the clarified answer (Q3): the picture
changes once, and one undo takes the whole edit back.

**Alternatives considered**: an inline field in the popover for editing and a separate
dialog for creating — rejected, two ways to type the same words; putting the created
text on the picture immediately with placeholder words and opening the popover —
rejected, it leaves a stray annotation when the user cancels.

## D8 — A kind with no properties has no settings control

**Decision**: the layer draws and the canvas hit-tests the settings control only when
`pluginOf(kind).properties` is non-empty. The image, which declares none, keeps its × and
copy and nothing else.

**Rationale**: the clarified answer (Q1) makes the control the way in. A control that
opens an empty panel is worse than no control: it teaches the user a dead end. It also
means the spec's edge case about a kind with nothing to change needs no message.

**Alternatives considered**: a disabled control — rejected, it is a dead end made
visible; an empty panel saying "nothing to change" — rejected, noise over the picture.

## D9 — The image offers nothing in this version

**Decision**: `ImageAnnotation` and its plugin are untouched. A border, opacity or
blend for a picture is a later property, added to that kind alone.

**Rationale**: the spec's assumption says the mechanism is what ships, proved by colour
on the arrow and text and the words of the text. Adding a property to the image would
need a new visual rule (what a picture's colour means) that the spec does not decide,
and it is not needed to prove the seam.

**Alternatives considered**: a border colour for the image — deferred, it needs a look
decided and a renderer change; an opacity for every kind — deferred, it is a property of
the picture more than of the annotation and needs a compositing decision.

## D10 — The palette, and why these six

**Decision**: the palette is the arrow's accent red, white, a warm yellow, a green, a
blue and a near-black. Both the arrow and the text keep their dark edge or outline
whatever the colour, so each reads over light and dark pictures.

**Rationale**: the kinds' outlines are what make a fixed set safe; a free picker would
let a user choose a colour that vanishes over their screen. Six is enough to matter and
small enough to show as one row of swatches in a popover.

**Alternatives considered**: the app's theme tokens — rejected, the picture is the
recorded screen, not the app, so a theme colour says nothing about legibility on it;
more colours — deferred, the set can grow without changing the mechanism.

## D11 — What is proved how

**Decision**:
- the rules — `colourOf` and the palette, `withColour` on both kinds, `withWords` (size
  kept, shrink to fit, anchor held), `stored`/`restore` with a colour, and the property
  lists each plugin declares — by **unit tests in node**;
- the settings control, the popover, the swatches, the text entry, the change in
  playback and the export, and undo — by a **browser harness** on the dev server;
- the reload with real IndexedDB, and the real focus/blur of the input — by the **user**,
  and stated as a gap.

**Rationale**: the Verification skill's rule. The existing kind tests are the regression
proof: they must pass unmodified, which is why the colour is optional in the geometry
with a default rather than a new required field.

**Alternatives considered**: unit-testing the popover with a fake DOM — rejected, the
skill is explicit that what a person sees is asserted in a harness, and the project has
no DOM test environment.