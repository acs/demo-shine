// One annotation: something drawn over the picture of a clip, for a stretch of its
// time.
//
// It carries identity, so a specific one can be picked, changed, deleted and taken
// back by the one undo; its kind, which is what both the rules and the drawing key
// on; the stretch it is shown over, as fractions of the clip, exactly as a cut is;
// and its geometry, as fractions of the picture, shaped by its kind.
//
// The value is made through `createAnnotation`, and that is the point: a geometry is
// normalised by its kind on the way in, so an annotation that could not be drawn
// inside the picture cannot be built.

import { Span } from '../clip/Span.js';
import { kindOf } from './kinds.js';

export type AnnotationId = string;

export interface Annotation<G = unknown> {
  readonly id: AnnotationId;
  /** Which kind it is — 'arrow' today. The id both registries key on. */
  readonly kind: string;
  /** When it is shown: fractions of the clip, like a cut. */
  readonly span: Span;
  /** Where it is: fractions of the picture, shaped by its kind. */
  readonly geometry: G;
}

/** Any annotation, whatever its kind — what a set holds. */
export type AnyAnnotation = Annotation<unknown>;

let seq = 0;

/** An id that will not collide with a restored one (those carry their own). */
export function newAnnotationId(): AnnotationId {
  seq += 1;
  return `an-${Math.random().toString(36).slice(2, 8)}-${seq}`;
}

/**
 * An annotation of a known kind, with its geometry normalised on the way in. Null
 * when the kind is unknown (a stored clip from a later version), or when the
 * geometry is not worth keeping (a stray click).
 */
export function createAnnotation<G>(
  kind: string,
  span: Span,
  geometry: G,
  id: AnnotationId = newAnnotationId(),
): Annotation<G> | null {
  const rules = kindOf(kind);
  if (!rules) return null;
  const normalised = rules.normalize(geometry) as G;
  if (!rules.isUsable(normalised)) return null;
  return { id, kind, span, geometry: normalised };
}
