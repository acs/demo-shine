# Contract — an annotation kind

This is the seam the feature exists to define. A **kind** is a subclass of
`Annotation` — the arrow is `Arrow` — and it is added by writing the class, naming it
in the register, and writing the renderer that draws it. **Nothing that already
exists changes** (FR-011, SC-005).

## 1. The class (pure)

`src/domain/annotation/Annotation.ts` is the abstract base; a kind extends it. The
arrow is `src/domain/annotation/Arrow.ts`.

```ts
export abstract class Annotation {
  protected constructor(readonly id: string, readonly span: Span, readonly kind: string) {}

  /** The points a drag can take hold of, in fractions of the picture. */
  abstract handles(): readonly AnnotationHandle[];
  /** The same annotation with one handle moved; null if that is not one of its handles. */
  abstract withHandle(end: string, to: Point): Annotation | null;
  /** The same annotation, shifted — how it is moved whole. */
  abstract movedBy(dx: number, dy: number): Annotation | null;
  /** The same annotation over a different stretch — how it follows a clip that grew. */
  abstract withSpan(span: Span): Annotation;
  /** Is a point on it, within `tolerancePx`? */
  abstract hitTest(x: number, y: number, w: number, h: number, tolerancePx: number): boolean;
  /** The annotation as it is written down. */
  abstract stored(): StoredAnnotation;
}
```

**Guarantees**

- every member is pure geometry — no canvas, no DOM: `src/domain/` may not have one;
- `stored()` returns plain numbers, so a clip's annotations are written down the same
  way its cuts are;
- the constructor is `protected`, so an annotation is made through its kind's own
  factory (`Arrow.create`), which is where a geometry is normalised and a stray click
  is refused.

## 2. The register (a clip read back)

`src/domain/annotation/kinds.ts` names the kinds this build knows, so a stored clip
can be opened again.

```ts
export interface AnnotationKind {
  readonly id: string;                                    // the class's static id
  restore(stored: StoredAnnotation): Annotation | null;    // the class's static restore
}

export function registerKind(kind: AnnotationKind): void;
export function annotationFrom(stored: StoredAnnotation): Annotation | null;
```

The class itself is the kind — `registerKind(Arrow)` — so there is one name to keep
true rather than two. `annotationFrom` answers `null` for a kind this version does not
know, so a clip from a later version opens with those annotations left out instead of
failing.

## 3. The renderer (the browser boundary)

`src/ui/annotation-layer.ts` holds the renderers, keyed by the same id.

```ts
export interface AnnotationRenderer<A extends Annotation> {
  readonly id: string;
  draw(ctx: CanvasRenderingContext2D, annotation: A, w: number, h: number, selected: boolean): void;
}
```

**Guarantees**

- a renderer only draws — how an annotation is picked, moved and aimed is the class's
  (`handles`, `hitTest`, `movedBy`, `withHandle`);
- it draws only inside `w × h`, so the same code is right for the preview canvas and
  for the export canvas whatever their sizes (FR-004, SC-003);
- `drawAnnotations(ctx, w, h, annotations, selectedId)` is the single entry point used
  by playback and by the export, so the file matches the review (FR-006, SC-002);
- a kind with no renderer is skipped, not a crash.

## The arrow, as the worked example

| Piece | Where | What it is |
|---|---|---|
| `Arrow` | `src/domain/annotation/Arrow.ts` | `static id = 'arrow'`; `create()` clamps both ends into `[0, 1]²` and refuses a stray click; `handles()` the two ends; `withHandle()`/`movedBy()` aim and move it; `hitTest()` within a tolerance of the segment; `stored()`/`restore()` write it down and read it back |
| `arrowRenderer` | `src/ui/annotation-layer.ts` | `draw()` a shaft with a solid head, in the app's accent, with a thin dark outline, and a dot on each end when it is picked |

## Adding the next kind — the checklist the contract promises

1. Write `src/domain/annotation/<Kind>.ts`: a class extending `Annotation`, with a
   static `id`, a static `create` (normalise, refuse a stray click), a static
   `restore`, and the geometry members — plus a test beside it.
2. Add it to the register in `src/domain/annotation/kinds.ts`.
3. Write its `AnnotationRenderer` and register it in `src/ui/annotation-layer.ts`.
4. Add its action where the actions are offered (the section's action row).

No existing kind, and no cut, is edited by any of these four steps.
