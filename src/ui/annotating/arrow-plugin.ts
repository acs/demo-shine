// The arrow: the first kind, and the worked example of the plugin seam.
//
// A line with a head, given by where it starts (`from`, the tail) and what it points
// at (`to`, the head) — both as fractions of the picture. Its shape and the rules for
// it are the domain class (`src/domain/annotation/Arrow.ts`); this file is the arrow
// in the view: the button the section offers, how it is drawn, and how a new one is
// made.
//
// Making one is a drag across the picture. The canvas owns the pointer plumbing and
// hands it back through `ctx.drag`, whose `build` is the arrow's own shape — so the
// draft the user sees while dragging is an `Arrow`, drawn by this renderer, and the
// commit is an `Arrow`. A stray click makes nothing and says so, and stays armed so
// the next try is a drag away rather than a selection to be made again.

import { Arrow } from '../../domain/annotation/Arrow.js';
import type { Annotation } from '../../domain/annotation/Annotation.js';
import { registerRenderer, type AnnotationRenderer } from './annotation-layer.js';
import { registerPlugin, type AnnotationPlugin } from './annotation-plugin.js';

const DRAFT_ID = 'draft';
const ARMED = 'ARROW — drag on the picture';
const STRAY = 'ARROW — drag across the picture';

const ACTION_ICON = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19L19 5"/><path d="M12 5h7v7"/></svg>';

// ── the look ──────────────────────────────────────────────────────────────────
//
// One style, defined once: a shaft with a solid head, in the app's action colour,
// with a thin dark edge so it reads over both light and dark pictures. The exact
// colour is a one-line change; a per-arrow style editor is not in this change.

const ACCENT = '#e53e3e';
const OUTLINE = 'rgba(2,3,8,0.72)';

/**
 * How big an arrow is drawn, in the picture's own pixels. It is a rule rather than a
 * magic number so that it can be tested: a mark must not swamp the picture it is
 * drawn over — the head is under 2% of the width and the shaft under 0.4%, at every
 * size the app records at.
 */
export function arrowMetrics(w: number): { head: number; weight: number; edge: number } {
  return {
    head: Math.max(6, w * 0.015),
    weight: Math.max(1.5, w * 0.0028),
    edge: Math.max(1, w * 0.0012),
  };
}

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

export const arrowRenderer: AnnotationRenderer<Arrow> = {
  id: Arrow.id,

  draw(ctx, arrow, w, h) {
    const { from, to } = arrow.geometry;
    const x0 = from.x * w, y0 = from.y * h;
    const x1 = to.x * w, y1 = to.y * h;
    const { head: size, weight, edge } = arrowMetrics(w);
    const angle = Math.atan2(y1 - y0, x1 - x0);
    const bx = x1 - Math.cos(angle) * size * 0.8;
    const by = y1 - Math.sin(angle) * size * 0.8;

    ctx.save();
    ctx.lineCap = 'round';
    line(ctx, x0, y0, bx, by, weight + edge * 2, OUTLINE);   // the dark edge first
    line(ctx, x0, y0, bx, by, weight, ACCENT);
    head(ctx, bx, by, angle, size + edge * 2, OUTLINE);
    head(ctx, bx, by, angle, size, ACCENT);
    ctx.restore();
  },
};

registerRenderer(arrowRenderer);

// ── the plugin ────────────────────────────────────────────────────────────────

export const arrowPlugin: AnnotationPlugin = {
  id: Arrow.id,

  action: {
    label: 'Arrow',
    title: 'Annotate this section with an arrow',
    icon: ACTION_ICON,
  },

  renderer: arrowRenderer as AnnotationRenderer<Annotation>,

  begin(ctx): void {
    ctx.say(ARMED);
    void (async () => {
      try {
        for (;;) {
          const drag = await ctx.drag((from, to) => Arrow.create(ctx.span, from, to, DRAFT_ID));
          const arrow = drag ? Arrow.create(ctx.span, drag.from, drag.to) : null;
          if (arrow) { ctx.commit(arrow); return; }
          // A stray click is not an arrow. Stay armed, so the next try is a drag
          // away rather than a selection to be made again.
          ctx.abandon(STRAY);
        }
      } catch {
        // The canvas was disarmed — Escape, a new selection, or the session over.
      }
    })();
  },
};

registerPlugin(arrowPlugin);
