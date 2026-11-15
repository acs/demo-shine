import { describe, expect, it } from 'vitest';

import { Span } from './Span.js';
import { SpanSet } from './SpanSet.js';

describe('SpanSet', () => {
  it('sorts what it is given', () => {
    expect(SpanSet.of([{ s: 0.6, e: 0.8 }, { s: 0.1, e: 0.2 }]).spans.map(x => x.s)).toEqual([0.1, 0.6]);
  });

  it('merges what overlaps, and what merely touches', () => {
    const set = SpanSet.of([{ s: 0.1, e: 0.3 }, { s: 0.3, e: 0.4 }, { s: 0.5, e: 0.6 }]);
    expect(set.spans.length).toBe(2);
    expect(set.spans[0].equals(Span.of(0.1, 0.4))).toBe(true);
  });

  it('takes a new range in without ever overlapping', () => {
    const set = SpanSet.of([{ s: 0.1, e: 0.2 }]).add(Span.of(0.15, 0.3)).add(Span.of(0.5, 0.6));
    expect(set.spans.map(x => [x.s, x.e])).toEqual([[0.1, 0.3], [0.5, 0.6]]);
  });

  it('answers where a point is, and where to leave it', () => {
    const set = SpanSet.of([{ s: 0.2, e: 0.4 }]);
    expect(set.contains(0.3)).toBe(true);
    expect(set.contains(0.4)).toBe(false);
    expect(set.endAt(0.3)).toBeCloseTo(0.4);
    expect(set.endAt(0.5)).toBeNull();
  });

  it('counts an overlap inside a window only once', () => {
    const set = SpanSet.of([{ s: 0.1, e: 0.2 }, { s: 0.15, e: 0.25 }]);   // merged to one
    expect(set.within(0, 1)).toBeCloseTo(0.15);
    expect(set.within(0.2, 0.5)).toBeCloseTo(0.05);
  });

  it('scales every edge, which is how fractions become seconds', () => {
    expect(SpanSet.of([{ s: 0.25, e: 0.5 }]).scaled(8).spans[0].equals(Span.of(2, 4))).toBe(true);
  });

  it('is empty when it has nothing, and knows it', () => {
    expect(SpanSet.of([]).isEmpty).toBe(true);
    expect(SpanSet.EMPTY.length).toBe(0);
    expect(SpanSet.of([{ s: 1, e: 3 }]).length).toBe(2);
  });
});
