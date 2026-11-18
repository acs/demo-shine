# Feature Specification: Video Annotations

**Feature Branch**: `feat/video-annotations`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "Let's go with a really core feature: annotations. Let's start adding the possibility to add an arrow to the video to put the focus in some part of the image. This is the first annotation that will define how the rest of annotations will be added to the framework, so it is critical to define an extensible design and architecture. The first idea I have in mind is to reuse the cut selection and evolve it to a generic selection which can be used for cutting or ... for annotating."

## Clarifications

### Session 2026-11-18

- Q: When the user takes back their most recent change, should a single undo cover both cuts and arrows, or should each kind be undone on its own? → A: One undo covers the most recent change of any kind — a cut or an arrow.
- Q: Should the timeline show where annotations are in time, or should arrows exist only over the picture? → A: The timeline shows each annotation's stretch, so it can be seen and reached.
- Q: How should a person pick an existing arrow and change it? → A: Click the arrow on the picture to pick it, drag its ends to move and aim it, and drag its span on the timeline to change the stretch.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Point at a detail with an arrow (Priority: P1)

A person has just recorded a clip and is reviewing it. One detail matters — a button, a field, a word on the screen — and the eye should land on it at the right moment. They select the stretch of the clip where it matters, choose to add an arrow, and draw it across the picture so its head sits on the detail. The arrow appears there while the clip plays and in the file they export.

**Why this priority**: This is the feature. An arrow over the right part of the picture at the right moment is the smallest thing worth shipping, and every later kind of annotation is built on the same act: choose a stretch, put something over the picture, see it in the output.

**Independent Test**: With a finished clip in review, select a stretch, draw an arrow onto a detail, then play the clip back and export it — the arrow appears over that detail for that stretch, and nowhere else.

**Acceptance Scenarios**:

1. **Given** a clip in review, **When** the user selects a stretch and adds an arrow to it, drawing it onto the picture, **Then** the arrow is shown over the picture for that stretch.
2. **Given** a clip with an arrow, **When** the playhead moves outside the arrow's stretch, **Then** the arrow is not shown.
3. **Given** a clip with an arrow, **When** the clip is played, **Then** the arrow stays over the same part of the picture as the frames move under it.
4. **Given** a clip with an arrow, **When** the clip is exported (a file, or a post), **Then** the arrow appears in the output at the same moment and over the same part of the picture as in the review.

---

### User Story 2 - Change or remove an arrow (Priority: P2)

The person who placed an arrow wants to move it, change where it points, change when it shows, or take it away — and to take a mistake back.

**Why this priority**: An arrow that cannot be fixed is a mistake that cannot be undone, so editing is what makes placing one safe. It is below the first story because one correct placement already delivers the value.

**Independent Test**: Place an arrow, then move it, change its stretch, delete it, and undo the deletion; each change is reflected in playback and in the export.

**Acceptance Scenarios**:

1. **Given** a clip with an arrow, **When** the user clicks it on the picture and drags an end, **Then** the arrow points somewhere else and the change is shown in playback.
2. **Given** a clip with an arrow, **When** the user drags its span on the timeline, **Then** it is shown only in the new stretch.
3. **Given** a clip with an arrow, **When** the user deletes it, **Then** it no longer appears, and the deletion can be undone.
4. **Given** a clip with an arrow, **When** the user looks at the timeline, **Then** the arrow's stretch is shown there, and reaching it does not mean playing through the clip.

---

### User Story 3 - The next kind of annotation fits the same frame (Priority: P3)

A second kind of annotation arrives later — a box, a label, a highlight. Adding it must be a matter of describing the new kind, not of reworking the kinds already there: an arrow keeps behaving exactly as it did, and a cut is untouched.

**Why this priority**: The user asked for the first annotation to *define* the rest, so the family has to grow cleanly. It is last because it delivers no user-visible value on its own — it is a promise the first kind has to keep.

**Independent Test**: Add a second kind of annotation and confirm that every arrow and every cut behaves exactly as before, and that the new kind is shown in playback and the export, is saved with the clip, and is undone the same way — with no change to the arrow's own behaviour.

**Acceptance Scenarios**:

1. **Given** the annotation family in place, **When** a second kind is added, **Then** no arrow or cut changes how it behaves.
2. **Given** a second kind of annotation, **When** it is used, **Then** it follows the same rules as an arrow — shown for its stretch, in playback and the export, kept with the clip, undone in one action.

---

### Edge Cases

- An arrow is drawn partly or wholly outside the recorded picture — it must not appear outside the frame, and it must not be lost.
- A cut removes part of the stretch an arrow shows over: the arrow is shown only over the kept part. A cut that removes the arrow's whole stretch leaves no arrow behind.
- A new take is recorded after an arrow was placed: the clip is longer, and the arrow must stay over the same moments it was placed on.
- The stretch an arrow shows over is very short — a few frames.
- An arrow is added when no stretch is selected, or when there is no clip, or the clip is not in review: it must not be possible, and the user must be told to select a stretch first.
- Several arrows overlap in time — each is shown on its own.
- The page is reloaded, or the trip to sign in to publish is taken: every arrow comes back in place.
- A delete is undone after a new take was recorded.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to add an arrow over the picture of a finished clip while reviewing it.
- **FR-002**: Users MUST be able to say where the arrow starts and what it points at, by drawing it across the picture.
- **FR-003**: An arrow MUST be shown only during the stretch of the clip the user chose for it, and MUST be shown for the whole of that stretch.
- **FR-004**: An arrow MUST stay over the same part of the picture as the clip plays — it is anchored to the picture, not to the screen or the window.
- **FR-005**: Arrows MUST be shown while the clip is played back, at the same moment and place as when placed.
- **FR-006**: Arrows MUST be included in every output of the clip — a downloaded file and a published post — at the same moment and over the same part of the picture as in the review.
- **FR-007**: Users MUST be able to pick an existing arrow by clicking it on the picture, move it and change where it points by dragging its ends, and change the stretch it is shown over by dragging its span on the timeline.
- **FR-008**: Users MUST be able to delete an arrow, and to undo that deletion.
- **FR-009**: Several arrows MUST be able to exist at once, including arrows that overlap in time.
- **FR-010**: Annotations MUST be kept with the clip: they MUST survive a reload and a return from the publishing sign-in, and MUST be let go when the session ends.
- **FR-011**: Adding a new kind of annotation MUST NOT change how existing kinds behave, and MUST NOT change how cuts behave.
- **FR-012**: An annotation MUST NOT change the recording itself — placing one never re-encodes the recording.
- **FR-013**: The stretch an annotation is shown over MUST be chosen with the same selection the user already uses to cut, and MUST be chosen **before** the annotation is added: the user selects a stretch, then chooses what to do with it — cut it, or annotate it. There is one way to point at a stretch of the clip, whatever is then done with it.
- **FR-014**: A cut MUST take its part of an arrow's stretch with it, exactly as it takes the picture: the arrow is never shown over a stretch that was cut away.
- **FR-015**: Undo MUST cover the most recent change of any kind, in one action: the one undo the user has takes back whatever they last did — an annotation added, an annotation deleted, or a cut approved — whichever kind it was.
- **FR-016**: The timeline MUST show where the annotations are — each annotation's stretch is drawn on it — so that a person can see and reach an annotation without playing or scrubbing through the clip.

### Key Entities *(include if feature involves data)*

- **Annotation**: something drawn over the picture of a clip, for a stretch of the clip's time. It has a *kind*, the *stretch* it is shown over, and whatever its kind needs to be drawn.
- **Arrow**: the first kind of annotation — a line with a head, given by where it starts and where it points, held against the picture so it follows the frames.
- **Selection**: the stretch of the clip the user is pointing at. Today it is what a cut is approved from; it becomes the one way to point at a stretch, whether it is then cut or annotated.
- **Clip**: holds the annotations beside the takes and the cuts; the annotations are small and are kept apart from the recording bytes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can open a finished clip and see an arrow they placed during playback in under 30 seconds.
- **SC-002**: In 100% of outputs (downloaded file and published post), an arrow appears at the same moment and over the same part of the picture as in the review.
- **SC-003**: An arrow placed on a detail stays on that detail for the whole of its stretch, as the picture moves beneath it.
- **SC-004**: Deleting an arrow and then undoing returns the clip to exactly what it was, in one action — through the same single undo that takes back a cut.
- **SC-005**: Adding a second kind of annotation changes the outcome of no existing arrow or cut test (no regression).
- **SC-006**: A clip with annotations survives a reload and comes back with every arrow in place, 100% of the time.
- **SC-007**: A person can find and reach any annotation they placed without playing through the clip.

## Assumptions

- Annotations are added in review, on a finished clip; they are not added while a take is being recorded.
- The first kind of annotation is the arrow. Other kinds are out of scope for this change; only the promise that they fit is in scope.
- In this first change an arrow has one look — a single colour and weight — rather than a per-arrow style editor.
- An arrow is drawn against the picture of the clip as a whole; where takes differ in shape, it is placed against the frame being shown, and is kept against the picture.
- The selection that today bounds a cut becomes a general selection: the user selects a stretch first, then chooses what to do with it — a cut, or an annotation. How the selection is *made* (two marks on the timeline) does not change.
- Annotations are small, like cuts, and are kept apart from the recording bytes, so writing one never means writing the recording again.
- A published post is an output of the clip, so annotations are included in it for the same reason they are included in a downloaded file.
- Annotations are the editor's own: a viewer watching the output has no way to turn them on or off.
