# Contract — an annotation property, and the inspector

The seam this feature adds, in the shape the rest of the annotation family already uses:
a kind says what can be changed about it, and one shared surface asks. **The inspector
names no kind**, and a property change is an ordinary change to the clip (spec FR-006,
FR-010).

## 1. The property descriptor (the view)

`src/ui/annotating/annotation-plugin.ts`

```ts
export type PropertyControl = 'colour' | 'text';

export interface AnnotationProperty {
  readonly id: string;                        // 'colour' | 'words'
  readonly label: string;                     // shown beside the control
  readonly control: PropertyControl;          // which shared control edits it
  value(annotation: Annotation): string;      // what the control shows
  with(annotation: Annotation, value: string): Annotation | null;  // null when refused
}

export interface AnnotationPlugin {
  readonly id: string;
  readonly action: AnnotationAction;
  readonly renderer: AnnotationRenderer<Annotation>;
  readonly properties?: readonly AnnotationProperty[];
  begin(ctx: CreationContext): void;
}
```

**Guarantees**

- a descriptor **only** says what the property is, what its value is and what the
  annotation becomes with another; it never touches the clip, the DOM or the store;
- `with` returns `null` for a value the kind will not take (empty words, a colour it does
  not know), and the inspector leaves the annotation unchanged and says why (FR-014);
- `properties` is optional: a kind without it has no settings control and no inspector,
  and every other behaviour is unchanged (FR-009);
- adding a property to a kind is a descriptor on that kind; adding a kind with
  properties is a descriptor on that kind — neither touches the inspector, the layer, the
  canvas or another kind (FR-007, SC-005);
- `'colour'` and `'text'` are the controls this version has. A new *control* is a shared
  change; a new *property* of an existing control is not.

## 2. The colour rule (the domain)

`src/domain/annotation/AnnotationColour.ts`

```ts
export const COLOURS = ['#e53e3e', '#ffffff', '#f6e05e', '#38a169', '#3182ce', '#111827'] as const;
export type AnnotationColour = (typeof COLOURS)[number];
export function colourOf(value: unknown, fallback: AnnotationColour): AnnotationColour;
```

**Guarantees**

- the palette is the whole of the allowed set; a value outside it becomes the fallback;
- a kind picks its own fallback, so a clip written before this change paints as it did;
- the rule lives once and is used by every kind that carries a colour — a kind does not
  copy the list or the check.

## 3. The kinds' own values

| Kind | Carries | Default | The property |
|---|---|---|---|
| Arrow | `Arrow.colour` | `#e53e3e` | `colour` |
| Text | `TextAnnotation.colour` | `#ffffff` | `colour`, `words` |
| Image | — | — | none |

**Guarantees**

- a value is part of the annotation: `stored()` writes it, `restore` reads it (tolerating
  its absence), and `withSpan` / `duplicated` / `movedBy` / `withHandle` carry it;
- `Arrow.withColour(colour)` and `TextAnnotation.withColour(colour)` keep the shape, the
  span and the id, so a colour can never make an annotation unusable;
- `TextAnnotation.withWords(words, measuredWidth)` keeps the anchor and the font size and
  refits the width; it shrinks both only when the words would otherwise run past the
  picture from the anchor. The width is **measured in the view and handed in** — the
  domain never measures (Principle II).

## 4. The inspector (the view)

`src/ui/annotating/properties-inspector.ts` — a singleton `inspector`, opened and closed
per use, with its own listeners, as `CameraMenu` is.

```ts
class PropertiesInspector {
  isOpen(): boolean;
  /** Open beside the picked annotation. No-op when the picked kind has no properties. */
  open(): void;
  /** Close; nothing selected is left changed. */
  close(): void;
  /** The settings control: open when closed, close when open. */
  toggle(): void;
}
```

**Guarantees**

- it asks `pluginOf(picked.kind)?.properties ?? []` and renders one control per
  descriptor; it has no per-kind branch and no `switch` on kind (FR-006, FR-008);
- a colour swatch applies through `clip.changeAnnotation(id, next)` at once; a words row
  opens the text entry and applies on confirm (Q1, Q3);
- every change is `clip.changeAnnotation`, so it is announced, undone by the one undo and
  kept with the clip — the inspector adds no second path (FR-003, FR-004, FR-010);
- it closes when the annotation is removed, when the clip is cleared, on Escape, on an
  outside click and on a resize; a new pick closes the old one and opens the new one from
  its own control (FR-015, FR-016);
- it is placed in viewport coordinates from the annotation's box, clamped, and lives at
  the body level so the preview cannot clip it — the camera menu's pattern.

## 5. The text entry (the view)

`src/ui/annotating/text-entry.ts` — a singleton `textEntry`, one opening at a time.

```ts
class TextEntry {
  /** Ask for a line. Resolves with the trimmed words, or null when cancelled. */
  ask(initial: string): Promise<string | null>;
}
```

**Guarantees**

- it is the app's own dialog: an input, Cancel and Add, Enter to confirm, Escape to
  cancel, the input focused; the browser `prompt` is gone (FR-013);
- the text kind's creation and the inspector's words row both use it, so entering and
  editing are one control (spec Assumption);
- it resolves `null` when cancelled, and the caller changes nothing.

## 6. The settings control (the layer and the canvas)

- `annotation-layer.ts` draws a third control on the picked annotation, from the same
  `controlSpot` geometry as the × and the copy, **only when the picked kind has
  properties**;
- `annotation-canvas.ts` hit-tests it before the grips and before the picture, so a press
  on it can never be a press that aims, and calls `inspector.toggle()`;
- a kind with no properties has no control, so there is nothing to open (D8).

## 7. The dependency rule

- `domain/annotation/` imports nothing from `application/`, `infra/` or `ui/`; it holds
  the palette, the values and the rules, and never measures or draws.
- `ui/annotating/` holds the descriptors, the inspector, the entry and the settings
  control, and may import `infra/` as the other view flows do.
- a value's storage is the kind's geometry; nothing else owns it.

## Adding a property to a kind — the checklist

1. Give the kind's geometry a field for the value, with a default and tolerant restore.
2. Add the kind's `with<Property>(value)` in the domain, with a test beside it.
3. Add a descriptor to that kind's plugin, with its `value` and `with`.
4. Have the renderer read the value.

Nothing else. The inspector shows it the next time the kind is picked.

## Adding a new *control* (a later change)

`PropertyControl` gains a value, the inspector gains one renderer for it, and the
descriptors that want it do. This is a shared change and must be its own pull request;
adding a property of an existing control never is.