# Contract — an annotation kind

This is the seam the feature exists to define. A **kind** is what makes one sort of
annotation different from another (an arrow, a box, a label, a highlight). A new kind
is added by writing its rules and its drawing and registering both under one id;
**nothing that already exists changes** (FR-011, SC-005).

A kind is described twice, because the domain may not draw and the view may not own
rules:

## 1. The domain descriptor (pure)

`src/domain/annotation/kinds.ts` holds the registry; each kind is a module beside it
(the arrow is `Arrow.ts`).

```ts
/** The rules of one kind, with no knowledge of a canvas. */
export interface AnnotationKind<G> {
  /** The id both registries key on, e.g. 'arrow'. */
  readonly id: string;
  /** The geometry a fresh one starts from, before the user's gesture shapes it. */
  defaultGeometry(): G;
  /** A geometry put back inside the picture — an arrow past the edge is pulled to it. */
  normalize(g: G): G;
  /** Is this geometry worth keeping, or a stray click? */
  isUsable(g: G): boolean;
}

export function kindOf(id: string): AnnotationKind<unknown> | null;
```

**Guarantees**

- `normalize` never throws and always returns a geometry inside `[0, 1]²`.
- `isUsable` is what stops a zero-length arrow becoming an annotation.
- `kindOf` returns `null` for an unknown id, so a stored clip from a future version
  degrades rather than throwing.

## 2. The view renderer (the browser boundary)

`src/ui/annotation-layer.ts` holds the renderer registry, keyed by the same id.

```ts
/** How one kind is drawn and picked, in fractions of the context's size. */
export interface AnnotationRenderer<G> {
  readonly id: string;
  /** Paint it. `selected` lets the picked one show its handles. */
  draw(ctx: CanvasRenderingContext2D, g: G, w: number, h: number, selected: boolean): void;
  /** Is a point (fractions of the picture) on it? Used to pick it. */
  hitTest(g: G, x: number, y: number, w: number, h: number): boolean;
  /** The points a drag can take hold of, in fractions — the ends, for an arrow. */
  handles(g: G): ReadonlyArray<{ x: number; y: number; end: 'from' | 'to' }>;
}
```

**Guarantees**

- a renderer draws **only inside** `w × h`, so the same code is right for the preview
  canvas and for the export canvas whatever their sizes (FR-004, SC-003);
- `drawAnnotations(ctx, w, h, annotations, selectedId)` is the single entry point used
  by playback and by the export, so the file matches the review (FR-006, SC-002).

## The arrow, as the worked example

| Piece | Where | What it is |
|---|---|---|
| `arrowKind` | `src/domain/annotation/Arrow.ts` | `id: 'arrow'`; `defaultGeometry()` a short horizontal line at the middle; `normalize()` clamps both points into `[0, 1]²`; `isUsable()` false below a small minimum length |
| `arrowRenderer` | `src/ui/annotation-layer.ts` | `draw()` a shaft with a solid head, in the app's accent, with a thin dark outline; `hitTest()` within a few pixels of the segment; `handles()` the two ends |

## Adding the next kind — the checklist the contract promises

1. Write `src/domain/annotation/<Kind>.ts` with its geometry type and its
   `AnnotationKind` (rules only), and a test beside it.
2. Register it in `src/domain/annotation/kinds.ts`.
3. Write its `AnnotationRenderer` (draw / hitTest / handles) and register it in
   `src/ui/annotation-layer.ts`.
4. Add its action where the actions are offered (the section's action row).

No existing kind, and no cut, is edited by any of these four steps.
