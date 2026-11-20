# Contract — an annotation plugin, and the shared canvas

This is the seam the feature exists to define. A kind is **a class** in
`domain/annotation/` (its shape and the rules for it) and **a plugin** in
`ui/annotating/` (its action, its renderer, and how a new one is made), under the same
id. Everything the spec calls shared — select, move, resize, copy, delete, undo — is
the canvas's, and a kind gets it by existing. **Adding a kind edits nothing that is
already there** (spec FR-008, FR-009, SC-002).

## 1. The class (pure) — what changes

`src/domain/annotation/Annotation.ts`

```ts
export interface HandleOptions {
  /** The user is asking for a free resize — a modifier is held. */
  readonly free?: boolean;
}

export abstract class Annotation {
  protected constructor(readonly id: string, readonly span: Span, readonly kind: string) {}

  abstract handles(): readonly AnnotationHandle[];
  /** The same annotation with one handle moved; null if that is not one of its handles. */
  abstract withHandle(end: string, to: Point, options?: HandleOptions): Annotation | null;
  abstract movedBy(dx: number, dy: number): Annotation | null;
  abstract withSpan(span: Span): Annotation;
  abstract duplicated(span: Span): Annotation;
  abstract hitTest(x: number, y: number, w: number, h: number, tolerancePx: number): boolean;
  abstract stored(): StoredAnnotation;
}
```

**Guarantees**

- the only signature that moves is `withHandle`, and its new argument is **optional** —
  `Arrow` ignores it and every existing call site and test is unchanged (spec SC-003);
- every member is still pure geometry — no canvas, no DOM, no `Blob` (Principle II);
- **resize is `withHandle`**: a kind says which handles it offers and where one goes;
  the arrow's ends are its resize, the image's corners are its resize, and the canvas
  does not care which (spec FR-004).

## 2. The plugin (the browser boundary)

`src/ui/annotating/annotation-plugin.ts`

```ts
export interface AnnotationAction {
  readonly label: string;   // 'Arrow' | 'Image' — the section's button
  readonly title: string;   // its tooltip
  readonly icon: string;    // its inline svg
}

export interface AnnotationRenderer<A extends Annotation> {
  readonly id: string;
  /** Paint it, inside `w × h`, in the picture's own proportions. */
  draw(ctx: CanvasRenderingContext2D, annotation: A, w: number, h: number): void;
}

export interface AnnotationPlugin {
  readonly id: string;                                // the domain kind's id
  readonly action: AnnotationAction;
  readonly renderer: AnnotationRenderer<Annotation>;
  /** Begin making one over the selected stretch. */
  begin(ctx: CreationContext): void;
}

export interface CreationContext {
  readonly span: Span;
  readonly picture: { readonly w: number; readonly h: number };
  /** Ask the canvas for a drag across the picture; null when it was abandoned. */
  drag(
    build: (from: Point, to: Point) => Annotation | null,
    minLength?: number,
  ): Promise<{ from: Point; to: Point } | null>;
  draft(annotation: Annotation | null): void;
  commit(annotation: Annotation): void;
  abandon(message: string): void;
  say(message: string): void;
}

export function registerPlugin(plugin: AnnotationPlugin): void;
export function pluginOf(id: string): AnnotationPlugin | null;
export function plugins(): readonly AnnotationPlugin[];
```

**Guarantees**

- a plugin **only** describes its kind: its action, how it is drawn, and how a new one
  is made. It never describes pick, move, resize, copy, delete, undo, saving or
  exporting — those are the canvas's and the clip's;
- `begin` is where a kind's creation lives, and it may be asynchronous (the arrow
  awaits a drag; the image awaits a chosen picture). A plugin may attach its own
  listeners — the image's paste and drop — and that is the spec's "some interactivity
  if needed" (FR-013);
- the id is the whole of the coupling between the class, the register in
  `domain/annotation/kinds.ts`, the plugin here, and the stored data — the same rule the
  renderer already follows;
- a plugin's `renderer` draws **only**, in the picture's own proportions, because what
  an annotation looks like is part of the picture and must export the same (FR-011);
- a kind with no plugin is not offered in the section's actions; a kind with no renderer
  draws nothing and is skipped, not a crash (FR-012).

## 3. The shared canvas

`src/ui/annotating/annotation-canvas.ts` — an object with a lifetime, as `annotation-edit.ts`
is today; `session.reset()` ends it.

```ts
class AnnotationCanvas {
  get selectedId(): string | null;
  get armed(): boolean;

  /** The section's action: make a new one of `kindId` over `span`. */
  add(kindId: string, span: Span): void;

  /** Pick one from outside the picture (the timeline lane). */
  pick(id: string | null): void;

  /** The annotation in hand is gone (removed, or the session ended). */
  forget(id?: string): void;

  /** The session is over, or the selection was dropped. */
  cancel(): void;

  /** Pointer plumbing, wired once by `initAnnotationCanvas`. */
  down(e: PointerEvent): void;
  move(e: PointerEvent): void;
  end(): void;

  /** The draft a plugin is showing, for the layer to draw. */
  preview(): Annotation | null;
}

export const canvas: AnnotationCanvas;
```

**Guarantees**

- the canvas names **no kind**: it asks `annotation.hitTest`, `movedBy`,
  `withHandle(end, to, { free })`, `duplicated`, and the clip's own
  add/change/remove/undo;
- the operations the spec calls shared are exactly these, and every kind has them by
  existing (FR-001 … FR-007);
- the **grips and the two controls** (copy, remove) are still drawn once by
  `annotation-layer.ts` from `handles()`, so a new kind gets the same editing UI
  without drawing any;
- the modifier (`Shift`) is read on the pointer event and passed as `options.free`; what
  it means is the kind's rule;
- a creation drag is routed to the armed plugin's `drag`, and the canvas draws the
  plugin's `draft` through the plugin's `renderer` — so a new kind's creation gesture
  needs no change here;
- the view listens: the canvas follows `clip.onChange` and never re-renders because it
  was the caller.

## 4. The register and the section's actions

`domain/annotation/kinds.ts` keeps `AnnotationKind { id, restore }` and registers
`Arrow` and `ImageAnnotation`; `ui/annotating/annotation-plugin.ts` registers the two
plugins. `ui/cutting/marks.ts` builds the section's action row from `plugins()`, so the
section offers **Arrow** and **Image** together (FR-022) and a new kind adds its own
button.

## 5. The dependency rule

- `domain/annotation/` imports nothing from `application/`, `infra/` or `ui/`. A kind
  is numbers and an id; it holds no `Blob` and draws nothing.
- `ui/annotating/` imports `domain/annotation/` and may import `infra/` (the image
  plugin's store and cache), as the other view flows already do.
- the plugin registry and the canvas are `ui/`; the class register is `domain/`.
- `main.ts` wires the two plugins and the canvas, as it wires the other views.

## The arrow, as the worked example

| Piece | Where | What it is |
|---|---|---|
| `Arrow` | `src/domain/annotation/Arrow.ts` | unchanged: `static id = 'arrow'`; `create()` clamps and refuses a stray; `handles()` the two ends; `withHandle()`/`movedBy()` aim and move it (the new options argument is ignored); `hitTest()`; `stored()`/`restore()` |
| `arrowPlugin` | `src/ui/annotating/arrow-plugin.ts` | `action` the **Arrow** button; `renderer` the shaft and head, moved from `annotation-layer.ts`; `begin` awaits a `drag`, builds an `Arrow`, `commit`s it, and `abandon`s a stray drag with the message under the timeline |

## Adding the next kind — the checklist the contract promises

1. Write `src/domain/annotation/<Kind>.ts`: a class extending `Annotation`, with a
   static `id`, a static `create` (normalise, refuse a stray), a static `restore`, and
   the geometry members — plus a test beside it.
2. Add it to the register in `src/domain/annotation/kinds.ts`.
3. Write `src/ui/annotating/<kind>-plugin.ts`: an `AnnotationPlugin` with its `action`,
   its `renderer`, and its `begin` — and register it.
4. Nothing else. The section offers its button, the canvas edits it, the lane finds it,
   the store keeps it and the export draws it.

No existing kind, and no cut, is edited by any of these four steps.
