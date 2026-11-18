// Ranges that cannot overlap: sorted, and merged on the way in.
//
// This is what the app calls the cuts — the stretches a cut took out. Everything that
// used to be a free function over a bare array (is this moment inside one, how
// long is left after them, where do I jump to leave one, how much of them falls
// inside this window) is a question asked of the set, and the set is what keeps
// the list tidy. A caller cannot hand round an unsorted, overlapping list, because
// `of` will not make one.

import { Span } from './Span.js';

/** Anything with two edges, so plain `{ s, e }` data can be handed in too. */
export type SpanLike = Span | { s: number; e: number };

const asSpan = (x: SpanLike): Span => (x instanceof Span ? x : Span.of(x.s, x.e));

export class SpanSet {
  private constructor(readonly spans: readonly Span[]) {}

  static readonly EMPTY = new SpanSet([]);

  /**
   * The set these ranges make: sorted, with anything that touches or overlaps
   * merged into one range. After this, `spans` is ordered and disjoint, so a
   * length is never counted twice and a lookup has one answer.
   */
  static of(ranges: readonly SpanLike[]): SpanSet {
    if (!ranges.length) return SpanSet.EMPTY;
    const sorted = ranges.map(asSpan).sort((a, b) => a.s - b.s);
    const out: Span[] = [];
    for (const span of sorted) {
      const last = out[out.length - 1];
      if (last && span.s <= last.e) out[out.length - 1] = last.merge(span);
      else out.push(span);
    }
    return new SpanSet(out);
  }

  /** This set with one more range in it — merged in, never overlapping. */
  add(range: SpanLike): SpanSet {
    return SpanSet.of([...this.spans, asSpan(range)]);
  }

  /** The range containing `v`, or null when none does. */
  at(v: number): Span | null {
    return this.spans.find(span => span.contains(v)) ?? null;
  }

  contains(v: number): boolean {
    return this.at(v) !== null;
  }

  /** Where to jump to leave the range containing `v`, or null when there is none. */
  endAt(v: number): number | null {
    return this.at(v)?.e ?? null;
  }

  /** How much of these ranges falls inside [start, end] — an overlap counted once. */
  within(start: number, end: number): number {
    let total = 0;
    for (const span of this.spans) {
      const from = Math.max(span.s, start);
      const to = Math.min(span.e, end);
      if (to > from) total += to - from;
    }
    return total;
  }

  /** The whole covered length. */
  get length(): number {
    return this.spans.reduce((total, span) => total + span.length, 0);
  }

  /** Every edge multiplied — how a set of fractions becomes seconds. */
  scaled(factor: number): SpanSet {
    return SpanSet.of(this.spans.map(span => Span.of(span.s * factor, span.e * factor)));
  }

  get isEmpty(): boolean {
    return this.spans.length === 0;
  }
}
