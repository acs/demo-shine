import { describe, expect, it } from 'vitest';

import { Span } from './Span.js';

describe('Span', () => {
  it('takes its edges in order, whichever way round they are given', () => {
    expect(Span.of(5, 2).s).toBe(2);
    expect(Span.of(5, 2).e).toBe(5);
  });

  it('is not worth offering when it is thinner than the minimum', () => {
    expect(Span.between(0.5, 0.502, 0.01)).toBeNull();
    expect(Span.between(0.5, 0.6, 0.01)?.length).toBeCloseTo(0.1);
  });

  it('holds its start and not its end, so adjacent ranges do not both claim a point', () => {
    const span = Span.of(1, 2);
    expect(span.contains(1)).toBe(true);
    expect(span.contains(2)).toBe(false);
    expect(span.touches(Span.of(2, 3))).toBe(true);
    expect(span.touches(Span.of(2.5, 3))).toBe(false);
  });

  it('dissolves in and out at its edges, full in the middle', () => {
    const span = Span.of(0.2, 0.6);                    // length 0.4
    expect(span.fadeAt(0.2, 0.08)).toBe(0);            // the start edge
    expect(span.fadeAt(0.24, 0.08)).toBeCloseTo(0.5);  // halfway into the fade
    expect(span.fadeAt(0.4, 0.08)).toBe(1);            // the middle, full
    expect(span.fadeAt(0.56, 0.08)).toBeCloseTo(0.5);  // halfway out
    expect(span.fadeAt(0.6, 0.08)).toBe(0);            // the end is outside it
    expect(span.fadeAt(0.1, 0.08)).toBe(0);            // before it
  });

  it('is shown in full when there is no fade, and reaches full in a range thinner than one', () => {
    expect(Span.of(0.2, 0.6).fadeAt(0.3, 0)).toBe(1);
    // 0.06 long, a fade of 0.08 either side: the middle is still full
    expect(Span.of(0.2, 0.26).fadeAt(0.23, 0.08)).toBe(1);
    expect(Span.of(0.2, 0.26).fadeAt(0.21, 0.08)).toBeCloseTo(0.33, 1);
  });

  it('merges two ranges into the width they cover', () => {
    expect(Span.of(1, 3).merge(Span.of(2.5, 6)).equals(Span.of(1, 6))).toBe(true);
  });

  it('has an overlap only when they really meet', () => {
    expect(Span.of(1, 3).intersection(Span.of(2, 5))?.equals(Span.of(2, 3))).toBe(true);
    expect(Span.of(1, 2).intersection(Span.of(2, 5))).toBeNull();
  });

  it('moves without changing length, and stays inside the clip', () => {
    const moved = Span.of(0.2, 0.4).movedTo(0.9);
    expect(moved.length).toBeCloseTo(0.2);
    expect(moved.e).toBeLessThanOrEqual(1);
    expect(Span.of(0.2, 0.4).movedTo(-3).s).toBe(0);
  });

  it('drags one edge, keeping the minimum length and staying inside the clip', () => {
    const span = Span.of(0.2, 0.6);
    expect(span.resized('s', 0.5, 0.1).equals(Span.of(0.5, 0.6))).toBe(true);
    expect(span.resized('s', 0.99, 0.1).s).toBeCloseTo(0.5);   // cannot pass its own end
    expect(span.resized('e', -1, 0.1).e).toBeCloseTo(0.3);     // cannot pass its own start
    expect(span.resized('e', 5).e).toBe(1);                    // nor leave the clip
  });
});
