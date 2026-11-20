# Feature Specification: Annotation Plugins

**Feature Branch**: `feat/annotation-plugins`

**Created**: 2026-11-20

**Status**: Draft

**Input**: User description: "We need to design the annotation architecture so it is extensible and based on a plugin architecture: adding a new annotation must be using some existing interfaces and a specific plugin annotation implementation (what is drawn, some interactivity if needed ...), but for example, features like selecting, deleting, moving, copying or resize must be shared by all annotations. The idea is to have a kind of canvas in which we add annotations objects. We need to evolve the arrow annotation to it, and to create a new annotation for adding an image as an annotation."

## Clarifications

### Session 2026-11-20

- Q: How does the user choose an image to add? → A: A file picker, pasting from the clipboard, and dragging a file onto the picture — all three.
- Q: Does resizing an image keep its proportions? → A: Keeps the image's own proportions by default, with a free resize (both directions) while a modifier is held.
- Q: Must every existing arrow and cut test pass unmodified as the proof the arrow did not regress? → A: Not strictly — an existing test may be updated where an equivalent implementation is needed for the generic annotation plugin architecture, provided the arrow's behaviour is not lost.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every annotation is edited the same way (Priority: P1)

A person has annotations over a clip — arrows today, and images once this change is in. Whatever the kind, the way they work with it is the same: click it on the picture to pick it, drag it to move it, drag a handle to resize it, copy it and paste another, delete it, and take any of it back with the one undo. Learning one kind teaches them all, and a kind that arrives later does not come with its own gestures to learn.

**Why this priority**: The user asked for selecting, deleting, moving, copying and resizing to be shared by every annotation. This is the heart of the change: the shared editing behaviour is what lets the family grow without editing code being written again for each kind, and it is the smallest slice that already improves the arrow people use today.

**Independent Test**: With two kinds present — an arrow and an image — pick each in turn and move, resize, copy, delete and undo it using the same gestures. Each behaves the same way, and neither has a private control the other lacks.

**Acceptance Scenarios**:

1. **Given** a clip with an arrow and an image, **When** the user clicks either on the picture, **Then** it is picked and shows the same set of handles and controls.
2. **Given** a picked annotation of any kind, **When** the user drags its body, **Then** it moves whole and stays over the same part of the picture.
3. **Given** a picked annotation of any kind, **When** the user drags one of its resize handles, **Then** its shape changes in the way that kind allows, and the change is shown in playback.
4. **Given** a picked annotation of any kind, **When** the user copies it and pastes, **Then** a new annotation of the same kind and shape appears at the playhead, in hand, editable on its own.
5. **Given** any annotation, **When** the user deletes it, **Then** it no longer appears and the one undo brings it back.

---

### User Story 2 - Put an image over the picture (Priority: P2)

A person wants to point something out by showing a picture over the recording — a logo, a reference screenshot, a diagram — for a stretch of the clip. They select that stretch, choose to add an image, pick the picture, place it where it belongs and size it, and it shows there in playback and in the file they export.

**Why this priority**: It is the new capability the user asked for, and it is the proof that a second kind fits the shared frame without touching the arrow. It is below the shared editing because the shared behaviour is what makes this kind cheap to add.

**Independent Test**: Add an image over a stretch, move and resize it, then play the clip and export it — the image shows over that stretch, in the right place and size, in both; and it is back in place after a reload.

**Acceptance Scenarios**:

1. **Given** a clip in review, **When** the user selects a stretch and adds an image, choosing a picture with the file picker, by pasting it from the clipboard, or by dragging a file onto the picture, **Then** the image is shown over the picture for that stretch.
2. **Given** a clip with an image, **When** the playhead moves outside the image's stretch, **Then** the image is not shown.
3. **Given** a clip with an image, **When** the user drags a corner of it, **Then** it resizes keeping its own proportions, and while a modifier is held it resizes freely in both directions.
4. **Given** a clip with an image, **When** the clip is exported (a file, or a post), **Then** the image appears at the same moment, place and size as in the review.
5. **Given** a clip with an image, **When** the page is reloaded or the trip to publish sign-in is taken, **Then** the image comes back in place without the user choosing it again.

---

### User Story 3 - A new kind is described, not fitted (Priority: P3)

A person adding the next kind of annotation — a box, a label, a blur — writes only that kind: what shape it is and what it looks like. Selecting, moving, resizing, copying, deleting, undoing, saving and exporting already work for it, because those belong to the family rather than to any one kind. The arrow, rebuilt as one kind among others, behaves exactly as it did, and a cut is untouched.

**Why this priority**: It is the promise that makes the family worth having, but it delivers no user-visible value on its own. It is last because the arrow's unchanged behaviour is a regression the change must not cause, and the image is the evidence the promise holds.

**Independent Test**: Add a kind by describing only its shape and how it is drawn, then confirm every arrow, image and cut behaves exactly as before and the new kind is shown, kept, edited and exported through the shared behaviour alone.

**Acceptance Scenarios**:

1. **Given** the family in place, **When** the arrow is rebuilt as a kind under the same contract, **Then** no arrow behaves differently and no cut is affected.
2. **Given** the family in place, **When** a kind is added by describing only its shape and how it is drawn, **Then** it can be selected, moved, resized, copied, deleted, saved, reloaded and exported with no editing behaviour of its own.
3. **Given** the new image kind, **When** the shared behaviour is exercised on it, **Then** the outcome of no existing arrow or cut test changes.

---

### Edge Cases

- A resize that would take an annotation outside the picture — it must not be lost: it is pulled to the edge, as an arrow's ends are today, rather than left outside the frame.
- A kind that cannot meaningfully resize along one axis, as a line-like arrow cannot widen — resize either does something sensible for it or is not offered for that direction.
- An annotation resized so small it would be a stray click — it must not vanish or become impossible to pick.
- An image that cannot be read (unsupported format, or a corrupt file) — the user is told, and nothing is added.
- A very large image — the app must not freeze, and the clip must still open and play.
- An image is added when no stretch is selected, when there is no clip, or the clip is not in review — it must not be possible, and the user is told to select a stretch first.
- A cut removes part of an image's stretch — the image is shown only over the kept part, and putting the cut back brings the rest back.
- Several annotations of different kinds overlap in time and on the picture — each is drawn and picked on its own, in a stable order that does not flicker.
- A delete is undone after a new take was recorded.
- A pasted image at the very end of the clip keeps its whole stretch inside the clip — the copy is pulled back rather than left hanging past the end.

## Requirements *(mandatory)*

### Functional Requirements

**Shared editing, for every kind**

- **FR-001**: All annotation kinds MUST share one set of editing operations — selecting, moving, resizing, copying, deleting and undoing — and a kind MUST NOT need editing behaviour of its own.
- **FR-002**: Users MUST be able to pick any annotation by clicking it on the picture, and MUST be able to tell which annotation is picked.
- **FR-003**: Users MUST be able to move any picked annotation whole, by dragging it, so it stays over the same part of the picture.
- **FR-004**: Users MUST be able to resize any picked annotation through handles its kind declares, in the way that kind allows.
- **FR-005**: Users MUST be able to copy any picked annotation and paste a new one of the same kind and shape at the playhead, and to edit the copy on its own.
- **FR-006**: Users MUST be able to delete any annotation, and to undo that deletion.
- **FR-007**: The one undo MUST continue to cover the most recent change of any kind — a cut, or any annotation added, changed or removed.

**Kinds and the plugin contract**

- **FR-008**: A kind MUST be describable in one place — its shape and the rules for that shape, and how it is drawn — without changing any other kind or the shared editing.
- **FR-009**: Adding a new kind MUST NOT change how existing kinds behave, and MUST NOT change how cuts behave.
- **FR-010**: Every kind MUST be kept with the clip, and MUST survive a reload and the return from the publishing sign-in.
- **FR-011**: Every kind MUST be shown in playback and in every output (a downloaded file and a published post) at the same moment, place and size as in the review.
- **FR-012**: A kind this version does not know MUST be left out when a clip is opened, rather than failing the open.
- **FR-013**: A kind MAY declare interactivity of its own beyond the shared operations, and where it does, that interactivity MUST be described with the kind and MUST NOT change the shared operations for other kinds.

**The image kind**

- **FR-014**: Users MUST be able to add an image as an annotation over a stretch of the clip, choosing the picture to use by a file picker, by pasting from the clipboard, or by dragging a file onto the picture.
- **FR-015**: An image annotation MUST be movable and resizable on the picture like any other kind. Resizing MUST keep the image's own proportions by default, and MUST allow a free resize in both directions while a modifier is held.
- **FR-016**: The picture the user chose MUST be kept with the clip, so the annotation comes back after a reload and appears in the export without the user choosing it again.
- **FR-017**: An image annotation MUST NOT change the recording itself — placing one never re-encodes the recording.

**The arrow, evolved**

- **FR-018**: The arrow MUST be rebuilt as a kind under the same contract and MUST behave exactly as it does today — shown for its stretch, aimed and moved by its ends, copied, deleted, undone, saved and exported.
- **FR-019**: The arrow's existing editing MUST become the shared behaviour rather than a private one, so that its ends are the handles the shared resize uses.
- **FR-020**: Every arrow placed before this change MUST still open and behave as before.

**Creating an annotation**

- **FR-021**: The stretch an annotation is shown over MUST still be chosen with the same selection used for cutting, and chosen **before** the kind is added: the user selects a stretch, then chooses what to do with it — cut it, or add a kind of annotation. There is one way to point at a stretch, whatever is then done with it.
- **FR-022**: The action to add each kind MUST be offered together, where the section's actions are offered, so that choosing a kind is choosing what to do with the selected stretch.

**Keeping an annotation**

- **FR-023**: Annotations of every kind MUST be written down beside the clip, apart from the recording bytes, so that adding one never means writing the recording again.

### Key Entities *(include if feature involves data)*

- **Annotation kind (plugin)**: one kind of thing drawn over the picture — an arrow, an image. It describes its own shape, the rules for that shape, and how it is drawn. It does **not** describe how it is selected, moved, resized, copied, deleted, saved or exported, because those belong to the family.
- **Annotation**: one instance of a kind, over a stretch of the clip's time, with a shape held in fractions of the picture. Identified, orderable, and kept with the clip.
- **Shared editing behaviour**: the one set of gestures and controls every kind gets — pick, move, resize, copy, delete and undo — together with the finder mark on the timeline lane.
- **Annotation canvas**: the layer over the picture where annotations are placed, drawn, picked and edited. One canvas serves the preview and the export, so the file matches the review.
- **Image annotation**: the new kind — a picture the user chose, placed and sized over the picture for a stretch of the clip.
- **Selection**: the stretch of the clip the user is pointing at. Unchanged from today: the user selects a stretch, then chooses a kind to add.
- **Clip**: holds the annotations of every kind beside the takes and the cuts; annotations are small and are kept apart from the recording bytes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With two or more kinds present, 100% of selecting, moving, resizing, copying, deleting and undo behave identically on each kind, with no kind-specific editing behaviour.
- **SC-002**: Adding a new kind changes the outcome of no existing arrow, image or cut test (no regression) and requires no edit to any existing kind or to the shared editing.
- **SC-003**: The arrow behaves exactly as before this change — every existing arrow and cut test passes unmodified, unless an equivalent feature implementation is needed for the generic annotation plugin architecture, in which case the test is updated to the equivalent behaviour rather than the behaviour being lost.
- **SC-004**: A person can add an image over a stretch, move and resize it, and see it in playback and in an export, in under 1 minute from choosing to add it.
- **SC-005**: In 100% of outputs (a downloaded file and a published post), every annotation appears at the same moment, place and size as in the review.
- **SC-006**: A clip with annotations of more than one kind survives a reload and comes back with every annotation in place, 100% of the time.
- **SC-007**: A person can find and reach any annotation they placed, of any kind, without playing through the clip.
- **SC-008**: Resizing a picked annotation follows the pointer with no perceptible lag, at every picture size the app records at.

## Assumptions

- The selection that bounds a cut is unchanged: a stretch is selected first, then a kind is chosen. This change does not introduce a free-drawing canvas where a kind is picked before a stretch is chosen; the "canvas" here is the layer the annotation objects live on and are edited through.
- Resize is expressed through the handles an annotation already declares — a kind says which handles it offers, and the shared behaviour draws and drags them. This is how the arrow's ends become the shared resize rather than a private one.
- Annotations of every kind are kept with the clip, as annotations already are, including an image's own picture, so nothing is chosen again after a reload.
- The arrow already exists and is rebuilt under the new contract; the image is the second kind and the worked proof that the contract holds.
- In this change an annotation has one look — a single colour and weight, a single image as chosen — rather than a per-annotation style editor.
- Annotations are the editor's own: a viewer watching the output has no way to turn them on or off.
- Where takes differ in shape, an annotation is placed against the frame being shown, as arrows are today.
- Annotations are small in number, like cuts, and are kept apart from the recording bytes.
- A published post is an output of the clip, so annotations of every kind are included in it for the same reason they are in a downloaded file.
- The three ways to choose an image — a file picker, pasting from the clipboard, and dragging a file onto the picture — all lead to the same annotation; which of them is offered is a matter of the surface the user is on.
- Resizing keeps an image's proportions unless a modifier is held; the arrow, being a line, resizes along its own length and is not distorted by the same rule.
- The project's usual refactor proof — the old tests pass unmodified — is deliberately relaxed for this change: where the generic annotation plugin architecture needs an equivalent implementation, an existing arrow or cut test may be updated to that equivalent behaviour. This is said out loud rather than done quietly, and the arrow's behaviour itself must not be lost (SC-003).
