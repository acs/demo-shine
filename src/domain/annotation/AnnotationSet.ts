// The annotations of a clip: identified, ordered, and allowed to overlap.
//
// This is deliberately not a `SpanSet`. The cuts merge and refuse to overlap
// because two cuts over the same moment are the same stretch of picture gone; two
// annotations over the same moment are two different things drawn on top of each
// other, which is what the user asked for. So the only rule here is identity — an
// id appears once — and the order kept is the order they are drawn in.

import { Span } from '../clip/Span.js';
import type { AnyAnnotation } from './Annotation.js';

export class AnnotationSet {
  private constructor(readonly all: readonly AnyAnnotation[]) {}

  static readonly EMPTY = new AnnotationSet([]);

  /** The set these make, with a repeated id taken once (the first wins). */
  static of(list: readonly AnyAnnotation[]): AnnotationSet {
    const seen = new Set<string>();
    const out: AnyAnnotation[] = [];
    for (const annotation of list) {
      if (seen.has(annotation.id)) continue;
      seen.add(annotation.id);
      out.push(annotation);
    }
    return new AnnotationSet(out);
  }

  get count(): number {
    return this.all.length;
  }

  get isEmpty(): boolean {
    return this.all.length === 0;
  }

  byId(id: string): AnyAnnotation | null {
    return this.all.find(annotation => annotation.id === id) ?? null;
  }

  /** This set with one more in it. A duplicate id is refused: the set is unchanged. */
  add(annotation: AnyAnnotation): AnnotationSet {
    if (this.byId(annotation.id)) return this;
    return new AnnotationSet([...this.all, annotation]);
  }

  /** This set with one replaced, keeping its place. An unknown id is refused. */
  change(id: string, next: AnyAnnotation): AnnotationSet {
    if (!this.byId(id)) return this;
    return new AnnotationSet(this.all.map(annotation => (annotation.id === id ? next : annotation)));
  }

  /** This set without one. An unknown id is refused: the set is unchanged. */
  remove(id: string): AnnotationSet {
    if (!this.byId(id)) return this;
    return new AnnotationSet(this.all.filter(annotation => annotation.id !== id));
  }

  /**
   * The annotations shown at a moment, as a fraction of the clip, in a stable
   * order (by where the stretch starts, then by id) so the draw order never flickers.
   */
  at(fraction: number): readonly AnyAnnotation[] {
    return this.all
      .filter(annotation => annotation.span.contains(fraction))
      .sort((a, b) => a.span.s - b.span.s || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  /** Every span multiplied — how a set of fractions follows a clip that grew. */
  rebase(factor: number): AnnotationSet {
    return AnnotationSet.of(this.all.map(annotation => ({
      ...annotation,
      span: Span.of(annotation.span.s * factor, annotation.span.e * factor),
    })));
  }
}
