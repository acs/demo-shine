// One annotation: something drawn over the picture of a clip, for a stretch of its
// time.
//
// It is a class, and a kind is a subclass of it — the arrow is `Arrow`. The base
// holds what every annotation has: identity, the stretch it is shown over, and the
// pure geometry a drag and a pick are made of. A kind adds its own shape and the
// rules for it.
//
// Nothing here draws. `src/domain/` may not touch a canvas, so how a kind looks
// lives in the view under the same id (`src/ui/annotation-layer.ts`), for the same
// reason `TakeRepository` is a port: the rules and the browser are kept apart.

import { Span } from '../clip/Span.js';

export type AnnotationId = string;

/** A point, as fractions of the picture. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A point a drag can take hold of, in fractions of the picture. */
export interface AnnotationHandle {
  readonly x: number;
  readonly y: number;
  readonly end: string;
}

/** One annotation as it is written down: its span and geometry, plain numbers. */
export interface StoredAnnotation {
  id: string;
  kind: string;
  s: number;
  e: number;
  geometry: unknown;
}

export abstract class Annotation {
  protected constructor(
    readonly id: AnnotationId,
    /** When it is shown: fractions of the clip, like a cut. */
    readonly span: Span,
    /** Which kind it is — the id both registries key on. */
    readonly kind: string,
  ) {}

  /** The points a drag can take hold of, in fractions of the picture. */
  abstract handles(): readonly AnnotationHandle[];

  /** The same annotation with one handle at a new point, or null if that is not one. */
  abstract withHandle(end: string, to: Point): Annotation | null;

  /** The same annotation, shifted — how it is moved whole. */
  abstract movedBy(dx: number, dy: number): Annotation | null;

  /** The same annotation over a different stretch — how it follows a clip that grew. */
  abstract withSpan(span: Span): Annotation;

  /**
   * A new annotation like this one, with its own identity — what a paste makes. The
   * stretch is given, because where a copy goes is not the copy's business.
   */
  abstract duplicated(span: Span): Annotation;

  /** Is a point (fractions of the picture) on it, within `tolerancePx`? */
  abstract hitTest(x: number, y: number, w: number, h: number, tolerancePx: number): boolean;

  /** This annotation as it is written down. */
  abstract stored(): StoredAnnotation;
}

let seq = 0;

/** An id that will not collide with a restored one (those carry their own). */
export function newAnnotationId(): AnnotationId {
  seq += 1;
  return `an-${Math.random().toString(36).slice(2, 8)}-${seq}`;
}
