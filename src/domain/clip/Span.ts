// A range, half-open: [s, e). The smallest value the timeline is built from.
//
// It exists because the rules about a range used to be free functions that every
// caller had to remember: sort the pair, clamp a drag inside the clip, keep a
// minimum length. Here they live with the thing they are about, and an
// out-of-order pair cannot be constructed by accident — `of` puts it in order, the
// way a pair of clicks does not care which came first.

export class Span {
  private constructor(
    readonly s: number,
    readonly e: number,
  ) {}

  /** A range from two edges, in order, whichever way round they are given. */
  static of(a: number, b: number): Span {
    return a <= b ? new Span(a, b) : new Span(b, a);
  }

  /**
   * The range between two marks, or null when it is thinner than `minGap` — which
   * is what makes a stray click not worth offering as a region.
   */
  static between(a: number, b: number, minGap = 0): Span | null {
    const span = Span.of(a, b);
    return span.length >= minGap ? span : null;
  }

  /** A degenerate range is a valid one, and means "nothing". */
  static empty(): Span {
    return new Span(0, 0);
  }

  get length(): number {
    return this.e - this.s;
  }

  isEmpty(): boolean {
    return this.e <= this.s;
  }

  /** Half-open: the start is inside, the end is not. */
  contains(v: number): boolean {
    return v >= this.s && v < this.e;
  }

  /** Whether the two share any point at all — touching counts. */
  touches(other: Span): boolean {
    return this.s <= other.e && other.s <= this.e;
  }

  /** The two ranges as one, assuming they do not have a gap worth keeping. */
  merge(other: Span): Span {
    return new Span(Math.min(this.s, other.s), Math.max(this.e, other.e));
  }

  /** The overlap, or null when they do not meet. */
  intersection(other: Span): Span | null {
    const s = Math.max(this.s, other.s);
    const e = Math.min(this.e, other.e);
    return e > s ? new Span(s, e) : null;
  }

  equals(other: Span): boolean {
    return this.s === other.s && this.e === other.e;
  }

  /**
   * The same length, starting at `toStart` — a dragged region. It stays inside
   * [0, 1], because that is the clip.
   */
  movedTo(toStart: number): Span {
    const s = Math.min(Math.max(toStart, 0), 1 - this.length);
    return new Span(s, s + this.length);
  }

  /** One edge dragged to `to`, at least `min` long and inside [0, 1]. */
  resized(edge: 's' | 'e', to: number, min = 0): Span {
    return edge === 's'
      ? new Span(Math.min(Math.max(to, 0), this.e - min), this.e)
      : new Span(this.s, Math.max(Math.min(to, 1), this.s + min));
  }

  toString(): string {
    return `[${this.s}, ${this.e})`;
  }
}
