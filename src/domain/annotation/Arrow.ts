// The arrow: the first kind of annotation, and the worked example of a kind.
//
// A line with a head, given by where it starts (`from`, the tail) and what it
// points at (`to`, the head), both as fractions of the picture so it lands in the
// same place on the preview, on the export canvas and after a reload. The rules
// live here and nothing here draws: `src/ui/annotation-layer.ts` does that, under
// the same id.

import type { AnnotationKind } from './kinds.js';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface ArrowGeometry {
  /** The tail, as fractions of the picture. */
  readonly from: Point;
  /** The head — what it points at. */
  readonly to: Point;
}

// Shorter than this (a fraction of the picture's width) and it is a stray click,
// not an arrow.
const MIN_LENGTH = 0.02;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// An arrow drawn past the edge is kept, pulled to the edge — it is not lost.
const clamp01 = (v: unknown): number => {
  const n = num(v);
  return n < 0 ? 0 : n > 1 ? 1 : n;
};

const point = (p: { x?: unknown; y?: unknown } | undefined): Point => ({
  x: clamp01(p?.x),
  y: clamp01(p?.y),
});

export const arrowKind: AnnotationKind<ArrowGeometry> = {
  id: 'arrow',
  defaultGeometry: () => ({ from: { x: 0.35, y: 0.5 }, to: { x: 0.65, y: 0.5 } }),
  normalize: g => ({ from: point(g?.from), to: point(g?.to) }),
  isUsable: g => Math.hypot(g.to.x - g.from.x, g.to.y - g.from.y) >= MIN_LENGTH,
};
