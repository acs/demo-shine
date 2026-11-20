# Phase 0 — Research

The decisions the plan rests on, each with what was chosen, why, and what else was
considered. Everything here is grounded in the code that exists today.

## D1 — The seam is a **view** plugin, and the class stays the kind

**Decision**: a kind keeps its two existing halves — a **class** in
`domain/annotation/` (its shape and the rules for it) and a **renderer** in
`ui/annotating/` under the same id — and this change adds a third piece in the view:
an **annotation plugin** that names the kind's action, its renderer, and how a new one
is made. The plugin is registered in one place, `ui/annotating/annotation-plugin.ts`,
keyed by the same id; the class is registered in `domain/annotation/kinds.ts` as it is
today.

**Rationale**: "what is drawn" and "how a new one is made" are both the browser's
business — a drag, a file picker, a canvas — so they belong in the view, and
`src/domain/` may not touch any of them (Principle II). What the *shape* is, and what
counts as a stray one, are rules, and those stay on the class, where the existing
`Arrow` already puts them and where the view asks polymorphically
(`annotation.movedBy(...)`, `annotation.withHandle(...)`). Putting the plugin in the
view keeps the domain pure and keeps one name — the kind's id — as the whole of the
coupling, exactly as the renderer registry does today.

**Alternatives considered**: a single domain-side `AnnotationKind` descriptor that
also held the drawing and the creation gesture — rejected, it would drag a canvas and
a file picker into `src/domain/`; an `instanceof`/`switch` on the kind in the canvas —
rejected, it is the thing the feature exists to remove (adding a kind would edit the
shared code); a generic plugin object that replaces the class — rejected, it would
split the shape rules from the type and repeat the first cut of the arrow, which the
project already decided against (`specs/001-video-annotations/research.md`, D2).

## D2 — The shared canvas is the generalisation of the arrow's gesture

**Decision**: `ui/annotating/annotation-edit.ts` becomes `annotation-canvas.ts`, an
object with a lifetime as it is today, and it stops naming the arrow. It owns the
operations the spec calls shared — **pick** (through the annotation's own `hitTest`),
**move** (`movedBy`), **resize** (a handle drag through `withHandle`), **copy**
(`duplicated` + the existing `Clipboard`), **paste**, **delete** (`removeAnnotation`)
and **undo** (the clip's one undo) — and it draws the grips and the two controls
(copy, remove) from the annotation's own `handles()`, which it already does.

**Rationale**: the arrow's gesture *already* has every shared operation except that
they are written against `Arrow` in a few places (the live preview builds an `Arrow`,
the copy message says "Arrow", the section's action arms the arrow). The honest change
is to make the one canvas polymorphic rather than to write a second one for the image;
a second canvas is how the two would drift — the same reason the layer is one place
(`specs/001-video-annotations/research.md`, D5). The grips and controls being drawn
from `handles()` already means a new kind gets them without drawing any, which is the
spec's FR-001.

**Alternatives considered**: a per-kind edit module — rejected, every kind would
re-implement pick/move/copy/delete and they would drift; a bounding-box resize drawn
by the canvas on top of each kind — rejected, it would add a second way to resize that
fights the arrow's own ends and hides the kind's own rule.

## D3 — Creation is the kind's own business, behind one small context

**Decision**: a plugin's `begin(context)` makes a new one over the selected stretch.
The context gives it exactly four things: the `span`, the picture's pixel size, a
`drag(build)` that asks the canvas for a drag across the picture and resolves with
where it started and ended, and three ways to report back — `draft(annotation)` (what
to show while it is being made), `commit(annotation)` (it is made; the clip takes it
and it is put in hand), and `abandon(message)` (nothing to make; say what to do). The
arrow's `begin` awaits a `drag` and builds an `Arrow`; the image's `begin` chooses a
picture and builds an `ImageAnnotation`.

**Rationale**: the two kinds are genuinely created differently — the arrow by a drag
across the picture, the image by choosing a file — and pretending otherwise would put
an arrow-shaped "from/to" into the shared code. `drag` is the one shared *gesture*
the canvas owns (it is pointer plumbing), while what the drag means stays in the
plugin through `build`. This is the "some interactivity if needed" the spec asks for
(FR-013): the plugin is ordinary view code and can attach its own listeners — the
image plugin's paste and drop are its own — without the shared canvas learning about
images.

**Alternatives considered**: one `create(span, from, to)` on every kind — rejected, it
forces the image into a drag it does not have; a `kind: 'drag' | 'choose'` flag in the
plugin — rejected, a flag is a switch in disguise and the third kind will not fit it;
opening the file picker from the section action outside the plugin — rejected, it puts
one kind's creation in the shared code.

## D4 — Resize is the handle drag; the modifier is one optional argument

**Decision**: resize **is** `withHandle(end, to)` — the arrow's ends are its resize
today, and the image's corners are its resize — and the base signature gains one
optional argument, `options?: { free?: boolean }`, so a kind can be told the user is
asking for a free resize (a modifier is held). `Arrow.withHandle(end, to)` ignores it;
`ImageAnnotation.withHandle(end, to, options)` uses it (D6).

**Rationale**: the spec asks for resize to be shared by all kinds, and the project
already has the shared mechanism: a kind declares `handles()` and how one moves. The
arrow is the proof it is enough — its "resize" is dragging an end. Only the image needs
to be told about a modifier, and an optional argument adds nothing to the kinds that do
not. It is also why the existing `Arrow` tests pass unmodified: a missing third
argument is the same call.

**Alternatives considered**: a new `resizedBy(handle, to, picture)` method beside
`withHandle` — rejected, two methods for one act; passing the picture's pixel size into
`withHandle` — rejected in favour of storing the picture's aspect on the image (D6),
which keeps the kind self-contained and the signature to one optional flag; a
per-kind resize in the canvas — rejected, the rule belongs on the class.

## D5 — The image kind holds geometry only; the bytes are not in the domain

**Decision**: `ImageAnnotation` holds `{ imageId, x, y, width, height, imageAspect,
pictureAspect }` — an id and numbers — and nothing else. The picture's bytes live in
`infra/`, addressed by `imageId`; the domain never sees a `Blob` and never decodes one.

**Rationale**: `src/domain/` may not touch a browser (Principle II), and a `Blob` is a
browser thing. The stored shape is the same idea the arrow already uses — plain numbers
under `geometry` — and it is why an image annotation is small enough for the clip's
**small half** (`Meta`), the record written on every change. It is also what makes a
copy cheap: `duplicated(span)` is a new id over the same `imageId`, so pasting an image
copies numbers, not megabytes (`specs/001-video-annotations/research.md`, D6).

**Alternatives considered**: the bytes inside the annotation's geometry — rejected, it
would put megabytes in the record that is rewritten on every change, the exact thing
the two-store split exists to prevent; a `Blob` on the domain object — rejected, the
domain may not hold one; no `imageId` and a rect alone — rejected, the drawing layer
would have nothing to resolve.

## D6 — Proportions: two ratios on the kind, kept by default, free with a modifier

**Decision**: the image's geometry carries `imageAspect` (the picture's own pixel
width ÷ height) and `pictureAspect` (the recorded picture's pixel width ÷ height, when
the annotation was made). Keep-proportions resize solves, from a new width fraction
`w`, the height fraction `h = w · pictureAspect ÷ imageAspect`; a free resize takes `h`
from the drag instead. The default is keep-proportions; a modifier makes it free (spec
FR-015, clarification Q2).

**Rationale**: the rect is in **fractions of the picture**, so a rect that looks square
on the screen is not square in the numbers unless the picture is square — the picture's
aspect is needed to keep the picture's own proportions. The domain cannot see the
canvas, so the aspect is captured once, when the annotation is made, and carried with
it; both ratios are plain numbers and the rule is testable in node with no browser.
Storing them (rather than passing the canvas in) is what keeps `withHandle`'s new
argument to a single optional flag (D4).

**Alternatives considered**: passing the canvas size into `withHandle` — rejected, it
widens the base contract for every kind; assuming a square picture — rejected, it would
distort every image on a 16:9 screen; recomputing the aspect from the bytes at resize —
rejected, the domain may not read a picture.

## D7 — Where a picture is kept: a third store, written once, and a decoded cache

**Decision**: `src/infra/clip-store.ts` gains a third IndexedDB object store, `images`
(DB version 3), keyed by `imageId`, holding the `Blob`. The annotation's stored
geometry carries the `imageId`, so the **small half** stays small and is still what is
written on every change. A new `src/infra/images.ts` owns the store and a **decoded
cache** — `imageId` → the decoded `HTMLImageElement` — made once per id, drawn many
times, and revoked when the session ends. The store is cleared with the clip.

**Rationale**: this is the split `clip-store.ts` was built for and states in its own
header: a take is megabytes and written once; the cuts are a few bytes and change on
every cut. A picture is exactly a take in that respect — megabytes, written once — and
an image annotation is exactly a cut — a few numbers, rewritten whenever anything
moves. Putting the bytes in `Meta` would re-write the picture on every drag of every
annotation. The decoded cache is the same idea as the object URLs `infra/takes.ts`
holds: make the browser handle once, keep it, and let go of it when the session does.

**Alternatives considered**: the bytes in `Meta` — rejected, above; a fourth kind of
record in `localStorage` — rejected, it holds a string and a few megabytes at most, and
would fragment the clip's one record; re-reading the `Blob` and decoding it on every
frame — rejected, it would drop frames; keeping only an object URL and no `Blob` —
rejected, it would not survive a reload (spec FR-016).

## D8 — Choosing a picture: three ways, while the image is being added

**Decision**: the image plugin offers all three the spec names (FR-014) — a hidden
`<input type="file" accept="image/*">` opened from the section's action, a `paste`
listener for a clipboard image, and `dragover`/`drop` on the preview — and all three
are live only while an image is being added (after a stretch is selected and the image
action pressed), not at any other time.

**Rationale**: the spec's clarification chose all three, because they are how people
actually gather a reference picture. Scoping them to the adding flow is what keeps them
from surprising anyone: a drop on the picture outside that flow is not a thing this
change should start doing, and the edge case "added when no stretch is selected" is
answered by saying to select a stretch first, rather than by silently starting. The
plugin is view code, so these listeners live with the kind and the shared canvas never
learns about a file.

**Alternatives considered**: the file picker only — rejected by the user's answer; a
drop that always works in review — rejected, it is a new behaviour with no selection to
attach the annotation to; a native drag-and-drop library — rejected, the platform's
own `drop` is enough and adds no dependency.

## D9 — One layer, one draw order, and the export waits for the pictures

**Decision**: drawing stays where it is — `drawAnnotations(ctx, w, h, annotations,
selectedId)` in `annotation-layer.ts`, called by playback and by the export alike — and
each kind's renderer is the plugin's. The image renderer resolves `imageId` through the
cache and `drawImage`s it into the annotation's rect, scaled to the canvas; a picture
not yet decoded is skipped rather than throwing. The export flow awaits the cache being
ready before it starts encoding.

**Rationale**: the spec's FR-011 and SC-005 require the file to match the review, and
the only way to be sure is one implementation in one place — the reason the layer is
one place already (`specs/001-video-annotations/research.md`, D5). The export is
offline and draws frames in a tight loop, so a decode cannot happen inside a frame;
waiting once, before the loop, is the same shape as the export already building its
plan before encoding a frame.

**Alternatives considered**: a second renderer for the export — rejected, two
implementations of "what an image looks like" will drift; decoding lazily inside the
frame — rejected, it would stall the loop; drawing the image onto the recorded frames —
rejected, the recording is never re-encoded (FR-017).

## D10 — A very large picture is downscaled once, when it is added

**Decision**: when a picture is added, it is decoded once and measured; if it is larger
than **twice** the clip's picture in either dimension, it is drawn down to that bound
on an offscreen canvas and that is what is kept and drawn. The user is told it was
made smaller. The downscale is done once, at add time, not per frame.

**Rationale**: the spec's edge case says a very large image must not freeze the app and
the clip must still open and play. Drawing a 8000-px picture scaled into a small rect
every frame is the way that freeze happens, and it is also what makes a kept clip
absurdly large. Bounding it at twice the picture keeps the picture sharp at the app's
own resolution (twice, so a zoom-in later is not soft) and bounds both the memory and
the per-frame cost. This re-encodes the *picture*, never the recording, which is what
FR-017 forbids.

**Alternatives considered**: keeping the original bytes and scaling per frame —
rejected, the freeze the edge case names; refusing a large picture — rejected, the user
wants it; a fixed megapixel cap — rejected, "twice the clip's picture" is the honest
bound and it scales with the recording.

## D11 — The section's actions come from the plugins

**Decision**: `ui/cutting/marks.ts` builds the section's action row from the registered
plugins — today an **Arrow** button and an **Image** button — instead of the one
hard-coded "annotate with an arrow" button, and the armed message under the timeline is
the plugin's. Adding a kind adds its button without editing the marks.

**Rationale**: the spec's FR-022 asks for the actions to be offered together, so
choosing a kind is choosing what to do with the selected stretch, and FR-021 keeps the
one selection unchanged. Building the row from the register is what makes "adding a
kind is a class, a renderer and a plugin" true of the UI too — otherwise the marks
would be the one place a new kind still had to be added by hand.

**Alternatives considered**: a hard-coded second button — rejected, it is the thing
that would have to change for the third kind; a kind picker inside the picture instead
of the section — rejected, it would move creation away from the selection the spec
keeps.

## D12 — Deleting an image does not free its bytes; the session does

**Decision**: removing an image annotation takes the annotation out of the clip and
nothing else; the kept picture stays until the session ends (New, or an export). The
`images` store and the decoded cache are let go together with the clip.

**Rationale**: the one undo must bring a deleted image back (FR-006), and it cannot if
its bytes are gone. Annotations are few, and the clip is a session's worth; the bytes
going with the session is the same lifetime the takes' object URLs have. Freeing bytes
on delete would need a reference count against the undo — more machinery than the
change is worth, and a way to lose a picture the user wanted back.

**Alternatives considered**: deleting the bytes with the annotation and restoring them
from the undo — rejected, the undo holds the annotation, not the bytes, so it would
have to hold a `Blob`; reference counting the picture across copies — rejected, the
lifetime is already the session and the count would only matter for a long session.

## D13 — What is proven how

**Decision**:
- the rules — `ImageAnnotation` (normalise, usable, keep-proportions resize, free
  resize, the four corners, `movedBy`, `hitTest`, `stored`/`restore`) and the unchanged
  `Arrow`, `AnnotationSet` and `Clip` rules — by **unit tests in node**;
- the plugin seam, the canvas, the image plugin, the layer, the section's actions, the
  export and the reload — by a **browser harness** on the dev server, asserting what a
  person would see;
- the recorder's flow is untouched, so no real-session check is needed for it, and the
  screen-share gap is stated.

**Rationale**: the Verification skill's rule — a rule in `domain/` is proved by a unit
test, anything drawn, played or encoded by a harness. The arrow's existing unit tests
are the regression proof for the seam (with the one stated departure, spec SC-003).

**Alternatives considered**: unit-testing the plugin and the canvas with a fake
context — rejected, the skill is explicit that what a person sees is asserted in a
harness, and the canvas is pointer plumbing a fake context cannot honestly stand in
for.
