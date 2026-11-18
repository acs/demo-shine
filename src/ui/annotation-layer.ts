// Drawing the annotations over the picture, and the renderers that know how.
//
// One layer serves the preview and the export: `drawAnnotations` is called by the
// playback loop and by the offline export, each on its own canvas, in fractions of
// whichever canvas is handed in — so an arrow lands in the same place in the file
// as on the screen, whatever the two sizes are.
//
// A renderer is registered under the same id as the kind's rules
// (src/domain/annotation/kinds.ts). That id is the whole of the coupling between
// what an annotation is allowed to be and how it looks: a new kind adds a renderer
// here, and nothing that is already drawn changes.

import type { AnyAnnotation } from '../domain/annotation/Annotation.js';
import { arrowKind, type ArrowGeometry } from '../domain/annotation/Arrow.js';

/** A point a drag can take hold of, in fractions of the picture. */
export interface Handle {
  x: number;
  y: number;
  end: 'from' | 'to';
}

export interface AnnotationRenderer<G> {
  readonly id: string;
  /** Paint it; `selected` lets the picked one show its handles. */
  draw(ctx: CanvasRenderingContext2D, g: G, w: number, h: number, selected: boolean): void;
  /** Is a point (fractions of the picture) on it? Used to pick it. */
  hitTest(g: G, x: number, y: number, w: number, h: number): boolean;
  /** The points a drag can take hold of, in fractions. */
  handles(g: G): readonly Handle[];
}

/** A renderer with its geometry erased, which is how the registry holds them. */
export interface AnyRenderer {
  readonly id: string;
  draw(ctx: CanvasRenderingContext2D, g: unknown, w: number, h: number, selected: boolean): void;
  hitTest(g: unknown, x: number, y: number, w: number, h: number): boolean;
  handles(g: unknown): readonly Handle[];
}

const renderers = new Map<string, AnyRenderer>();

export function registerRenderer<G>(renderer: AnnotationRenderer<G>): void {
  renderers.set(renderer.id, {
    id: renderer.id,
    draw: (ctx, g, w, h, selected) => renderer.draw(ctx, g as G, w, h, selected),
    hitTest: (g, x, y, w, h) => renderer.hitTest(g as G, x, y, w, h),
    handles: g => renderer.handles(g as G),
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
  annotations: readonly AnyAnnotation[],
  selectedId: string | null = null,
): void {
  for (const annotation of annotations) {
    const renderer = renderers.get(annotation.kind);
    if (!renderer) continue;    // a kind this version cannot draw: nothing, not a crash
    renderer.draw(ctx, annotation.geometry, w, h, annotation.id === selectedId);
  }
}

// ── the arrow ─────────────────────────────────────────────────────────────────
//
// One style, defined once: a shaft with a solid head, in the app's action colour,
// with a thin dark outline so it reads over both light and dark pictures. The exact
// colour is a one-line change; a per-arrow style editor is not in this change.

const ACCENT = '#e53e3e';
const OUTLINE = 'rgba(2,3,8,0.72)';

const px = (fraction: number, size: number): number => fraction * size;

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

/** How far a point is from a segment, in the same units as the points. */
function distanceToSegment(px0: number, py0: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0, dy = y1 - y0;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((px0 - x0) * dx + (py0 - y0) * dy) / lengthSq)) : 0;
  return Math.hypot(px0 - (x0 + t * dx), py0 - (y0 + t * dy));
}

export const arrowRenderer: AnnotationRenderer<ArrowGeometry> = {
  id: arrowKind.id,

  draw(ctx, g, w, h, selected) {
    const x0 = px(g.from.x, w), y0 = px(g.from.y, h);
    const x1 = px(g.to.x, w), y1 = px(g.to.y, h);
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
      dot(ctx, x0, y0, Math.max(4, w / 100));
      dot(ctx, x1, y1, Math.max(4, w / 100));
    }
    ctx.restore();
  },

  hitTest(g, x, y, w, h) {
    const d = distanceToSegment(px(x, w), px(y, h), px(g.from.x, w), px(g.from.y, h), px(g.to.x, w), px(g.to.y, h));
    return d <= Math.max(9, w / 55);
  },

  handles: g => [
    { x: g.from.x, y: g.from.y, end: 'from' },
    { x: g.to.x, y: g.to.y, end: 'to' },
  ],
};

registerRenderer(arrowRenderer);
