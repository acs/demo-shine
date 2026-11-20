// The text: the third kind, and the test of the seam — it was added without editing the
// arrow, the image, the canvas or the store.
//
// A line of text over the picture, for a stretch of the clip's time. Where it sits and
// how big it is are a box in **fractions of the picture**; the box's height is the
// font size, and its width is what the text measured at that size, so drawing at any
// canvas size lands the same place and the same size as the review.
//
// The box is the whole of the kind's shape: picking is inside it, moving shifts it, and
// resizing a corner scales both its width and its height by the same factor — which is
// what makes the text grow and shrink with it. There is no free resize: text is not a
// picture to stretch.

import { Span } from '../clip/Span.js';
import {
  Annotation, newAnnotationId,
  type AnnotationHandle, type Point, type StoredAnnotation,
} from './Annotation.js';

export interface TextGeometry {
  readonly text: string;
  /** The box, as fractions of the picture: top-left, width, height. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// Smaller than this (a fraction of the picture) and it is not text to draw.
const MIN_SIZE = 0.02;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

function rect(x: unknown, y: unknown, width: unknown, height: unknown): { x: number; y: number; width: number; height: number } {
  const w = clamp01(num(width));
  const h = clamp01(num(height));
  return {
    width: w,
    height: h,
    x: Math.min(clamp01(num(x)), 1 - w),
    y: Math.min(clamp01(num(y)), 1 - h),
  };
}

export class TextAnnotation extends Annotation {
  static readonly id = 'text';

  private constructor(id: string, span: Span, readonly geometry: TextGeometry) {
    super(id, span, TextAnnotation.id);
  }

  /**
   * A new piece of text, its box pulled inside the picture. Null when there is nothing
   * to say or the box is too small to draw — a stray one is not text.
   */
  static create(span: Span, geometry: TextGeometry, id: string = newAnnotationId()): TextAnnotation | null {
    const r = rect(geometry?.x, geometry?.y, geometry?.width, geometry?.height);
    const text = typeof geometry?.text === 'string' ? geometry.text : '';
    const annotation = new TextAnnotation(id, span, { text, ...r });
    return annotation.isUsable ? annotation : null;
  }

  /** Rebuild one from what was written down. Null when it is not text to draw. */
  static restore(stored: StoredAnnotation): TextAnnotation | null {
    const g = stored.geometry as Partial<TextGeometry> | null | undefined;
    if (!g) return null;
    return TextAnnotation.create(Span.of(stored.s, stored.e), {
      text: typeof g.text === 'string' ? g.text : '',
      x: g.x as number, y: g.y as number, width: g.width as number, height: g.height as number,
    }, stored.id);
  }

  /** Is this worth keeping, or too small to draw? */
  get isUsable(): boolean {
    return this.geometry.text.trim() !== ''
      && this.geometry.width >= MIN_SIZE
      && this.geometry.height >= MIN_SIZE;
  }

  handles(): readonly AnnotationHandle[] {
    const { x, y, width, height } = this.geometry;
    return [
      { x, y, end: 'nw' },
      { x: x + width, y, end: 'ne' },
      { x: x + width, y: y + height, end: 'se' },
      { x, y: y + height, end: 'sw' },
    ];
  }

  /**
   * Resize from the corner opposite the one dragged, scaling the box — and so the text
   * with it. There is no free resize: text is not stretched.
   */
  withHandle(end: string, to: Point): TextAnnotation | null {
    const { x, y, width, height } = this.geometry;
    // The fixed corner, and the box the drag asks for from the dragged one.
    let anchorX: number, anchorY: number, w: number, h: number;
    switch (end) {
      case 'nw': anchorX = x + width; anchorY = y + height; w = anchorX - to.x; h = anchorY - to.y; break;
      case 'ne': anchorX = x;         anchorY = y + height; w = to.x - anchorX; h = anchorY - to.y; break;
      case 'se': anchorX = x;         anchorY = y;          w = to.x - anchorX; h = to.y - anchorY; break;
      case 'sw': anchorX = x + width; anchorY = y;          w = anchorX - to.x; h = to.y - anchorY; break;
      default: return null;
    }
    // One factor scales both, so the text keeps its shape: it fits inside the box the
    // drag describes rather than stretching past the pointer.
    const k = Math.min(w / width, h / height);
    const nw = Math.max(MIN_SIZE, width * k);
    const nh = Math.max(MIN_SIZE, height * k);
    const left = end === 'nw' || end === 'sw' ? anchorX - nw : anchorX;
    const top  = end === 'nw' || end === 'ne' ? anchorY - nh : anchorY;
    return TextAnnotation.create(this.span, {
      text: this.geometry.text, x: left, y: top, width: nw, height: nh,
    }, this.id);
  }

  movedBy(dx: number, dy: number): TextAnnotation | null {
    const { text, x, y, width, height } = this.geometry;
    return TextAnnotation.create(this.span, { text, x: x + dx, y: y + dy, width, height }, this.id);
  }

  withSpan(span: Span): TextAnnotation {
    // The stretch says when it is shown, not what it says, so it can never make text
    // unusable — the box is untouched.
    return new TextAnnotation(this.id, span, this.geometry);
  }

  duplicated(span: Span): TextAnnotation {
    // Built straight rather than through `create`: this came from text already inside
    // the picture and worth keeping.
    return new TextAnnotation(newAnnotationId(), span, this.geometry);
  }

  hitTest(x: number, y: number): boolean {
    const { x: left, y: top, width, height } = this.geometry;
    return x >= left && x <= left + width && y >= top && y <= top + height;
  }

  stored(): StoredAnnotation {
    return {
      id: this.id,
      kind: this.kind,
      s: this.span.s,
      e: this.span.e,
      geometry: this.geometry,
    };
  }
}