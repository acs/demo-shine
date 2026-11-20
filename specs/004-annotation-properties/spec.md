# Feature Specification: Annotation Properties

**Feature Branch**: `feat/annotation-properties`

**Created**: 2026-11-20

**Status**: Draft

**Input**: User description: "Properties inspector: it is odd that the text cannot be modified once it is entered, and at some point we need a way to modify properties of an annotation, like the colour (and in this case, the text)."

## Clarifications

### Session 2026-11-20

- Q: When an annotation is picked, should its properties open by themselves, or wait for a settings control to be pressed? → A: A settings control on the picked annotation opens and closes the panel.
- Q: When a text is re-worded, should the font size the user chose stay and the box follow the new words, or should the box stay where it is and the words be re-fitted inside it? → A: The font size stays; the box follows the words and stays inside the picture; the font shrinks only if the words would not fit.
- Q: While someone is editing a text's words, should the picture update on every keystroke, or only when they confirm the edit? → A: Only on confirm, so one undo takes the whole edit back and the picture never shows a half-typed line.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Change how an annotation looks after it is placed (Priority: P1)

A person has placed an arrow over a detail and, on seeing it in the picture, wants it in a different colour — the accent one clashes with the screen it points at. They pick the arrow and open its properties, choose another colour, and the arrow is that colour in playback and in the file they export. It took one change, and the one undo takes it back.

**Why this priority**: This is the gap in one sentence — an annotation is placed, moved and resized but never re-specified. Colour is the smallest property that proves the whole mechanism (a kind offers a property; the inspector edits it; the change is announced, undone and kept like any other).

**Independent Test**: Place an arrow, pick it, change its colour, then play the clip and export it — the arrow is the new colour in both — and undo once to return it to the old one.

**Acceptance Scenarios**:

1. **Given** a clip with an arrow, **When** the user picks it and presses its settings control, **Then** the properties its kind offers are shown — the arrow's colour among them.
2. **Given** a picked arrow, **When** the user chooses another colour, **Then** the arrow is that colour in the picture at once, and in playback and in the export.
3. **Given** a colour change, **When** the user presses the one undo, **Then** the arrow is back to its previous colour in a single action.
4. **Given** a clip with a recoloured arrow, **When** the page is reloaded, **Then** the arrow comes back in that colour.

---

### User Story 2 - Change the words of a text after it is placed (Priority: P2)

A person has typed a line over the clip and notices a typo, or wants it to say something else now that they see it in place. They pick the text and change its words; it stays exactly where it was and its box grows or shrinks to fit the new words, inside the picture.

**Why this priority**: It is the specific oddity that started this — text that cannot be edited once entered is a mistake that cannot be corrected except by deleting and retyping. It is below the first story because colour already proves the mechanism, and the text is one more property of one more kind.

**Independent Test**: Place a text, pick it, change its words, and see the new words in the picture, in playback and in the export, in the same place — and undo once to return the old words.

**Acceptance Scenarios**:

1. **Given** a clip with a text annotation, **When** the user picks it and opens its settings, **Then** its words are shown in an editable field.
2. **Given** a picked text, **When** the user changes its words and confirms, **Then** the new words are shown in the same place, the box follows their length, the font keeps the size the user set unless the words would not fit, and the whole box stays inside the picture.
3. **Given** a text the user empties, **When** they confirm, **Then** the change is refused, the text is unchanged, and the user is told why.
4. **Given** a re-worded text, **When** the user presses the one undo, **Then** the previous words are back in a single action.

---

### User Story 3 - The next property, and the next kind, fit the same inspector (Priority: P3)

Someone adds a property to a kind — weight for an arrow, opacity for a picture — or adds a kind with properties of its own. The inspector shows the new control without being reworked, and the kinds already there behave exactly as they did.

**Why this priority**: It is the promise that keeps this from becoming a per-kind panel. It delivers no user-visible value on its own, so it is last — but without it the feature is one inspector per kind, which is the thing the plugin seam exists to avoid.

**Independent Test**: Give an existing kind a new property and add a second kind with a property, and confirm the inspector shows both without edits to it, and that no existing annotation or cut changes outcome.

**Acceptance Scenarios**:

1. **Given** the inspector in place, **When** a kind declares an additional property, **Then** the inspector shows it with no edit to the inspector or to any other kind.
2. **Given** the inspector in place, **When** a kind is added with properties of its own, **Then** its properties are shown when it is picked, and every other kind behaves as before.
3. **Given** the kinds already in the app, **When** one of them is picked, **Then** the inspector shows only the properties that kind offers — never another kind's.

---

### Edge Cases

- Nothing is picked — no inspector is shown, and the picture is as it was.
- The picked kind offers no properties at all — it is still picked, moved, resized, copied, deleted and undone as before, and it has no settings control, so there is nothing to open.
- The user picks a different annotation while the inspector is open — the open panel closes with the annotation it belonged to, and the new one's is opened from its own control; the panel never shows one annotation's properties while another is picked.
- The user lets go of the picked annotation, or it is deleted — the inspector closes with it.
- The user empties a text, or types only spaces — the change is refused and the text is unchanged.
- A text grows past the picture — its box is pulled inside, and if the words would not fit at the size the user set, the font shrinks until they do; it is never left half off the frame, and it is not wrapped into lines in this version.
- A value that is not a usable value for its property — a colour that is not a colour, a number outside what the kind allows — is refused, the annotation is unchanged, and the user is told.
- A property is changed while the clip plays, and while it is paused on a still frame — both work, and the change is shown from that moment on.
- The user changes a property and then undoes it after a new take was recorded.
- A property is changed and the page is reloaded, or the trip to publish sign-in is taken — the value comes back.
- Two annotations overlap at the playhead — the inspector is for the picked one, and changing it does not touch the other.
- A cut removes part of the picked annotation's stretch — the inspector still shows what the annotation is; the picture shows it only where its stretch survives.
- A text is re-worded so it no longer fits its old box — the box follows the words rather than clipping them.
- A text is being edited but not yet confirmed — the picture still shows the old words, and leaving or confirming with no change leaves it exactly as it was.
- The recording is never re-encoded by a property change, however many are made.

## Requirements *(mandatory)*

### Functional Requirements

**Changing what is there**

- **FR-001**: Users MUST be able to pick any annotation and see the properties its kind offers for editing.
- **FR-002**: Users MUST be able to change a property of the picked annotation and see the change at once in the picture, in playback, and in every output — the download and the published post.
- **FR-003**: The one undo MUST cover a property change exactly as it covers adding, moving or removing an annotation — one action, back to the previous value.
- **FR-004**: A property change MUST be kept with the clip and MUST survive a reload and the return from the publishing sign-in.
- **FR-005**: A property change MUST NOT change the recording itself — it never re-encodes the recording.

**How a kind takes part**

- **FR-006**: A kind MUST declare the properties it offers; the inspector MUST be one shared surface that names no kind and asks each kind what it has.
- **FR-007**: Adding a property to a kind, or adding a kind with properties of its own, MUST NOT require a change to the inspector or to any other kind.
- **FR-008**: The inspector MUST show only the properties of the picked kind, and MUST NOT show a property the kind does not offer.
- **FR-009**: A kind that offers no properties MUST keep every other behaviour — picking, moving, resizing, copying, deleting, undoing, saving and exporting — unchanged.
- **FR-010**: A property value MUST be changeable only through the same path as every other change to an annotation, so that announcing, undoing and keeping it are not re-implemented per property.

**What can be changed in this version**

- **FR-011**: Users MUST be able to change the colour of an annotation for the kinds that draw with one — the arrow and the text in this version.
- **FR-012**: Users MUST be able to change the words of a text annotation after it is placed, without changing its place, and the text's box MUST follow its new words and stay inside the picture, keeping the font size the user set unless the words would not fit at that size. The change MUST take effect when the user confirms it, and the one undo MUST take the whole edit back.
- **FR-013**: The browser's own prompt MUST NOT be how text is entered or edited; the text is entered and changed in the app's own interface.
- **FR-014**: A value that cannot be used for its property MUST be refused, the annotation left unchanged, and the user told why.

**Where and when it is shown**

- **FR-015**: The inspector MUST be opened from a control on the picked annotation, and MUST close when that control is pressed again, when the annotation is let go, or when it is deleted.
- **FR-016**: Picking another annotation MUST offer that one's properties through its own control; picking none MUST leave nothing open.

### Key Entities *(include if feature involves data)*

- **Annotation property**: something about an annotation the user can change after it is placed — its colour, its words. A kind declares which ones it offers and what values they allow; the inspector renders them; the value lives with the annotation.
- **Properties inspector**: the one shared surface that shows and edits the picked annotation's properties, whatever its kind.
- **Colour**: one flat colour an annotation is drawn in. A kind has a default; the user may choose another.
- **Text content**: the words a text annotation shows. Changing them keeps the annotation where it is and makes its box follow.
- **Annotation**: unchanged in what it is — something drawn over the picture for a stretch — but its properties can now be re-specified after it is placed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can change a placed arrow's colour in under 10 seconds from picking it and opening its settings, and see it in playback without leaving the review.
- **SC-002**: In 100% of outputs (the downloaded file and the published post), a changed property appears at the same moment, place and size as in the review.
- **SC-003**: A person can re-word a placed text without its place changing, and the text stays wholly inside the picture 100% of the time at the size the user set — the font shrinks only when the new words could not fit at that size.
- **SC-004**: Changing a property and then pressing the one undo returns the previous value in one action, 100% of the time.
- **SC-005**: Adding a property to a kind, or adding a kind with properties, changes the outcome of no existing annotation or cut test (no regression) and requires no edit to the inspector.
- **SC-006**: A clip with changed properties survives a reload and comes back with every value in place, 100% of the time.
- **SC-007**: The inspector never shows a property the picked kind does not offer, in 100% of picks.

## Assumptions

- **Where the inspector lives**: a small popover on the picked annotation, opened by a settings control beside the copy and remove controls it already has. This keeps it on the picture, where the thing being changed is, needs no new region of the page, and leaves the picture clear while an annotation is only being moved. A kind with no properties has no settings control.
- **What this version offers**: colour for the arrow and the text, and the words for the text. The image offers no properties in this version; its border, opacity and so on are a later change. The mechanism is what this version ships, with these properties as the proof.
- **Text is edited in the inspector's field**, and the browser prompt used when the text kind was added goes away. Entering and editing a text use the same control.
- **Colour is one flat colour per annotation.** Gradients, opacity, weight and per-kind extras are out of scope here.
- **One annotation at a time**: the inspector is for the picked annotation; there is no multi-select.
- **The picked annotation's stretch is under the playhead** while it is edited — picking holds the frame, as it does today — so the user sees the change as they make it.
- **A property's value lives with the annotation** and is written down with it, so nothing is re-chosen after a reload.
- **A colour is chosen from the app's own set**, not a free-form picker, in this version: the kinds' defaults plus a small palette, so every choice is one the app can draw legibly over any picture.
- **A property change is an ordinary change to the clip** — announced, undone, kept — and not a separate track of edits.