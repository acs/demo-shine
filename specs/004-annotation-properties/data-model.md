# Phase 1 — Data Model

The entities this feature adds or changes, their fields, the rules they enforce, and how
they move. Field names are the ones the code will use; the words are the ones
`GLOSSARY.md` gains first (step 1 of the plan).

## New entity — `AnnotationColour`, the palette

`src/domain/annotation/AnnotationColour.ts`

```ts
/** The colours an annotation may be drawn in. Chosen so each reads over light and dark. */
export const COLOURS = ['#e53e3e', '#ffffff', '#f6e05e', '#38a169', '#3182ce', '#111827'] as const;

export type AnnotationColour = (typeof COLOURS)[number];

/** The colour a stored value means, or the fallback when it is not one of ours. */
export function colourOf(value: unknown, fallback: AnnotationColour): AnnotationColour;
```

**Rules**

- the list is the whole of the palette: a colour outside it is not a colour, and
  `colourOf` answers the fallback rather than throwing;
- a kind supplies its own fallback — the arrow's `#e53e3e`, the text's `#ffffff` — so a
  clip written before this change paints exactly as it did;
- `colourOf` accepts only an exact palette entry; anything else (`undefined`, a
  damaged value, a colour from a later version) becomes the fallback.

## Changed entity — `Arrow`, the first kind

`src/domain/annotation/Arrow.ts`

| Member | Change |
|---|---|
| `ArrowGeometry` | gains `colour: AnnotationColour` |
| `Arrow.create(span, from, to, id?, colour?)` | the colour is optional and defaults to the arrow's red |
| `withColour(colour)` | **new** — the same arrow, ends and stretch, in another colour |
| `stored()` | includes the colour in `geometry` |
| `restore` | reads the colour through `colourOf`, so an older one paints red |

**Rules**

- colour never changes the shape: `withColour` keeps the ends, the span and the id, so
  it can never make an arrow unusable;
- `withHandle`, `movedBy`, `withSpan` and `duplicated` carry the colour — an arrow that
  is aimed, moved or copied keeps the colour it was given;
- an unknown stored colour is the default, not an error.

## Changed entity — `TextAnnotation`, the third kind

`src/domain/annotation/TextAnnotation.ts`

| Member | Change |
|---|---|
| `TextGeometry` | gains `colour: AnnotationColour` |
| `TextAnnotation.create(span, geometry, id?)` | normalises the colour through `colourOf`, defaulting to white |
| `withColour(colour)` | **new** — the same text, box and stretch, in another colour |
| `withWords(words, measuredWidth)` | **new** — the same text with new words, its box refitted |
| `stored()` / `restore` | carry the colour; an older one reads back white |

**Rules**

- `withWords(words, measuredWidth)` keeps the anchor (`x`, `y`) and the font size (the
  box's `height`), sets the width to `measuredWidth`, and only when that width would run
  past the picture from the anchor (`measuredWidth > 1 - x`) shrinks both by
  `k = (1 - x) / measuredWidth` until they fit. **The anchor never moves**, so a re-worded
  text does not jump (spec FR-012);
- `measuredWidth` is the width the new words measure at the annotation's current height,
  as a fraction of the picture — **measured in the view and handed in** (Principle II);
- a re-worded text to `''` is refused by `create` (nothing to say), so the inspector must
  refuse an empty entry before calling;
- `withWords` keeps the colour, the span and the id;
- the minimum box size still applies: a text cannot be shrunk away.

## New entity — `AnnotationProperty`, the descriptor

`src/ui/annotating/annotation-plugin.ts`

```ts
/** Which shared control edits a property. */
export type PropertyControl = 'colour' | 'text';

/** Something about an annotation the user can change after it is placed. */
export interface AnnotationProperty<A extends Annotation = Annotation> {
  readonly id: string;                        // 'colour' | 'words'
  readonly label: string;                     // shown in the popover
  readonly control: PropertyControl;          // which control renders it
  /** The value the control shows. */
  value(annotation: A): string;
  /** The same annotation with a new value; null when that value is not allowed. */
  with(annotation: A, value: string): A | null;
}
```

and on the plugin:

```ts
export interface AnnotationPlugin {
  readonly id: string;
  readonly action: AnnotationAction;
  readonly renderer: AnnotationRenderer<Annotation>;
  /** What can be changed after it is placed. A kind with none gets no settings control. */
  readonly properties?: readonly AnnotationProperty[];
  begin(ctx: CreationContext): void;
}
```

**Rules**

- a descriptor never decides *whether* a value is allowed beyond what the kind can
  enforce; it returns `null` and the inspector leaves the annotation unchanged and says
  why (spec FR-014);
- `value` is what the control shows for the picked annotation — a palette entry for a
  colour, the words for a text;
- the descriptor list is **on the kind**, so adding a property is that kind's change and
  the inspector is untouched (FR-007);
- the image declares none, so the settings control is not drawn for it (D8).

## The properties the kinds declare

| Kind | Properties |
|---|---|
| Arrow | `colour` — `control: 'colour'`, the palette, the arrow's red as its default |
| Image | none |
| Text | `colour` — the text's white as its default; `words` — `control: 'text'`, the current words, applying through `withWords` after the view measures them |

## View entities — the inspector and the text entry

`src/ui/annotating/properties-inspector.ts` and `src/ui/annotating/text-entry.ts`

| Entity | What it is | Lifetime |
|---|---|---|
| `PropertiesInspector` (singleton `inspector`) | The popover: watches the picked annotation, renders the picked kind's properties with the shared controls, applies a change through `clip.changeAnnotation`. Owns its open state and its listeners (outside click, Escape, resize), as `CameraMenu` does. | Opened and closed per use; nothing survives a session |
| the settings control | A third control on the picked annotation, drawn by the layer and hit-tested by the canvas. Its placement is the same `handles()` geometry as the × and the copy. | Drawn only while its annotation is picked |
| `TextEntry` (singleton `textEntry`) | The one in-app way to type words: a body-level dialog with an input, Cancel and Add, Enter to confirm, Escape to cancel, the input focused. `ask(initial): Promise<string \| null>`. | One opening |

**Rules**

- the inspector names no kind: it asks `pluginOf(kind).properties` and renders each
  control from its `control` field;
- it shows the popover only when the picked kind has properties (D8);
- it follows the clip: `annotation-changed` re-renders, `annotation-removed` and
  `cleared` close it, and a new pick closes it or re-renders for the new one;
- a colour swatch applies at once; a words edit applies on confirm (Q3), and a cancelled
  entry changes nothing;
- pressing the settings control again closes the popover; so do Escape, an outside click
  and a resize — the camera menu's behaviour.

## Changed entity — the annotation layer and the canvas

| Piece | Change |
|---|---|
| `annotation-layer.ts` | draws a third control — the settings gear — from the same `controlSpot` geometry, and only when the picked kind has properties |
| `annotation-canvas.ts` | hit-tests the settings control before the grips, and toggles the inspector for the picked annotation |

**Rules**

- the settings control sits off the annotation's middle like the other two, so a press on
  it can never be a press that aims;
- the canvas still owns picking, moving and resizing; the control only asks the inspector
  to open.

## Changed entity — the stored shape

`StoredAnnotation.geometry` is already `unknown`, so no shape change is needed; the two
kinds write one more field:

```ts
// arrow
geometry: { from, to, colour }          // colour is new
// text
geometry: { text, x, y, width, height, colour }   // colour is new
```

**Rules**

- a clip stored before this change has no colour; `colourOf` reads it back as the kind's
  default, so it paints exactly as it did;
- a colour that is not in the palette reads back as the default;
- nothing else about the stored shape moves — the pictures are kept as they are, and the
  recording is never touched.

## State transitions

| From | Event | Effect |
|---|---|---|
| a clip with an arrow | the user presses the settings control | the inspector opens for that arrow |
| a picked arrow | the user chooses a swatch | `withColour` → `clip.changeAnnotation` → `annotation-changed`; the picture, playback and the export show the new colour; one undo holds the previous annotation |
| a picked text | the user edits the words and confirms | the view measures → `withWords` → `changeAnnotation` → the box follows and the picture shows the new words; one undo takes the whole edit back |
| a picked text | the user cancels the entry | nothing changes; the inspector stays open |
| a picked text | the user empties the words and confirms | the inspector refuses, the text is unchanged, and the user is told |
| the picked annotation | another annotation is picked | the popover closes with the first; the second's opens from its own control |
| the picked annotation | it is deleted, or the session ends | the popover closes |
| a clip with changed properties | the page reloads | the clip store's small half carries the values; every annotation comes back as it was |