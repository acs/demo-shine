// Drawing the annotations over the picture, and the renderers that know how.
//
// One layer serves the preview and the export: `drawAnnotations` is called by the
// playback loop and by the offline export, each on its own canvas, in fractions of
// whichever canvas is handed in — so an arrow lands in the same place in the file
// as on the screen, whatever the two sizes are.
//
// A renderer is registered under the same id as the annotation's own kind — the
// class `Arrow` — and a renderer draws and nothing else: how an annotation is
// picked, moved and aimed is geometry, and lives on the class
// (`src/domain/annotation/Arrow.ts`). That is the whole of the coupling between what
// an annotation is allowed to be and how it looks, and a new kind adds a renderer
// here without changing what is already drawn.

import type { Annotation } from '../domain/annotation/Annotation.js';
import { Arrow } from '../domain/annotation/Arrow.js';

export interface AnnotationRenderer<A extends Annotation> {
  readonly id: string;
  /** Paint it; `selected` lets the picked one show what can be dragged. */
  draw(ctx: CanvasRenderingContext2D, annotation: A, w: number, h: number, selected: boolean): void;
}

/** A renderer with its annotation erased, which is how the registry holds them. */
interface AnyRenderer {
  readonly id: string;
  draw(ctx: CanvasRenderingContext2D, annotation: Annotation, w: number, h: number, selected: boolean): void;
}

const renderers = new Map<string, AnyRenderer>();

export function registerRenderer<A extends Annotation>(renderer: AnnotationRenderer<A>): void {
  renderers.set(renderer.id, {
    id: renderer.id,
    draw: (ctx, annotation, w, h, selected) => renderer.draw(ctx, annotation as A, w, h, selected),
  });
}

export function rendererOf(id: string): AnyRenderer | null {
  return renderers.get(id) ?? null;
}

/** Paint every annotation shown at this moment, in order. */
export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  annotations: readonly Annotation[],
  selectedId: string | null = null,
): void {
  for (const annotation of annotations) {
    renderers.get(annotation.kind)?.draw(ctx, annotation, w, h, annotation.id === selectedId);
  }
}

// ── the arrow ─────────────────────────────────────────────────────────────────
//
// One style, defined once: a shaft with a solid head, in the app's action colour,
// with a thin dark outline so it reads over both light and dark pictures. The exact
// colour is a one-line change; a per-arrow style editor is not in this change.

const ACCENT = '#e53e3e';
const OUTLINE = 'rgba(2,3,8,0.72)';

function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, width: number, colour: string): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function head(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number, colour: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.55, size * 0.55);
  ctx.lineTo(-size * 0.55, -size * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = ACCENT;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = Math.max(1, r * 0.5);
  ctx.stroke();
}

export const arrowRenderer: AnnotationRenderer<Arrow> = {
  id: Arrow.id,

  draw(ctx, arrow, w, h, selected) {
    const { from, to } = arrow.geometry;
    const x0 = from.x * w, y0 = from.y * h;
    const x1 = to.x * w, y1 = to.y * h;
    const size = Math.max(7, w * 0.03);
    const weight = Math.max(2, w / 300);
    const angle = Math.atan2(y1 - y0, x1 - x0);
    const bx = x1 - Math.cos(angle) * size * 0.8;
    const by = y1 - Math.sin(angle) * size * 0.8;

    ctx.save();
    ctx.lineCap = 'round';
    line(ctx, x0, y0, bx, by, weight + Math.max(2, w / 180), OUTLINE);   // outline first
    line(ctx, x0, y0, bx, by, weight, ACCENT);
    head(ctx, bx, by, angle, size * 1.25, OUTLINE);
    head(ctx, bx, by, angle, size, ACCENT);
    if (selected) {
      for (const handle of arrow.handles()) dot(ctx, handle.x * w, handle.y * h, Math.max(4, w / 100));
    }
    ctx.restore();
  },
};

registerRenderer(arrowRenderer);
