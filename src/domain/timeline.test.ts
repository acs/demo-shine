import { describe, expect, it } from 'vitest';

import {
  MIN_TRIM_GAP,
  addSpan,
  clampToClip,
  clipSeconds,
  estimateWebmText,
  keptLength,
  normalizeTrim,
  spanAt,
  spanBetween,
  spanLength,
} from './timeline.js';

describe('normalizeTrim', () => {
  it('leaves a valid range untouched', () => {
    expect(normalizeTrim(100, 800, 'start')).toEqual({ s: 100, en: 800 });
  });

  it('pushes IN back when the start handle crosses OUT', () => {
    expect(normalizeTrim(990, 1000, 'start')).toEqual({ s: 1000 - MIN_TRIM_GAP, en: 1000 });
  });

  it('pushes OUT forward when the end handle crosses IN', () => {
    expect(normalizeTrim(0, 5, 'end')).toEqual({ s: 0, en: MIN_TRIM_GAP });
  });
});

describe('clipSeconds', () => {
  it('scales the trimmed fraction by the duration', () => {
    expect(clipSeconds(10, 0.2, 0.8)).toBeCloseTo(6);
  });

  it('is zero for an empty range', () => {
    expect(clipSeconds(10, 0.5, 0.5)).toBe(0);
  });
});

describe('clampToClip', () => {
  it('clamps a position below the start up to the start', () => {
    expect(clampToClip(1, 2, 8)).toBe(2);
  });

  it('clamps a position past the end back to the end', () => {
    expect(clampToClip(9, 2, 8)).toBe(8);
  });

  it('leaves a position inside the range untouched', () => {
    expect(clampToClip(5, 2, 8)).toBe(5);
  });
});

describe('size estimates', () => {
  it('formats a WebM estimate', () => {
    expect(estimateWebmText(5)).toBe('~0.5–2.8 MB (WebM)');
  });
});

describe('spanBetween', () => {
  it('orders the two marks', () => {
    expect(spanBetween(0.7, 0.2)).toEqual({ s: 0.2, e: 0.7 });
  });

  it('rejects a region thinner than the gap', () => {
    expect(spanBetween(0.5, 0.505, 0.01)).toBeNull();
  });

  it('accepts a region exactly at the gap', () => {
    expect(spanBetween(0.5, 0.51, 0.01)).toEqual({ s: 0.5, e: 0.51 });
  });
});

describe('addSpan', () => {
  it('keeps the list sorted', () => {
    expect(addSpan([{ s: 0.6, e: 0.8 }], { s: 0.1, e: 0.2 })).toEqual([
      { s: 0.1, e: 0.2 },
      { s: 0.6, e: 0.8 },
    ]);
  });

  it('merges an overlapping span', () => {
    expect(addSpan([{ s: 0.2, e: 0.5 }], { s: 0.4, e: 0.7 })).toEqual([{ s: 0.2, e: 0.7 }]);
  });

  it('merges spans that touch', () => {
    expect(addSpan([{ s: 0.2, e: 0.5 }], { s: 0.5, e: 0.6 })).toEqual([{ s: 0.2, e: 0.6 }]);
  });

  it('swallows a span contained in another', () => {
    expect(addSpan([{ s: 0.2, e: 0.8 }], { s: 0.4, e: 0.5 })).toEqual([{ s: 0.2, e: 0.8 }]);
  });

  it('does not mutate the input', () => {
    const spans = [{ s: 0.2, e: 0.4 }];
    addSpan(spans, { s: 0.3, e: 0.9 });
    expect(spans).toEqual([{ s: 0.2, e: 0.4 }]);
  });
});

describe('spanAt', () => {
  const spans = [{ s: 0.2, e: 0.5 }, { s: 0.7, e: 0.9 }];

  it('finds the span containing a value', () => {
    expect(spanAt(spans, 0.3)).toBe(0);
    expect(spanAt(spans, 0.8)).toBe(1);
  });

  it('treats the start as inside and the end as outside', () => {
    expect(spanAt(spans, 0.2)).toBe(0);
    expect(spanAt(spans, 0.5)).toBe(-1);
  });

  it('is -1 outside every span', () => {
    expect(spanAt(spans, 0.6)).toBe(-1);
  });
});

describe('spanLength / keptLength', () => {
  it('counts only the part inside the range', () => {
    expect(spanLength([{ s: 0.2, e: 0.8 }], 0.5, 1)).toBeCloseTo(0.3);
  });

  it('does not double-count overlapping spans', () => {
    expect(spanLength([{ s: 0.2, e: 0.6 }, { s: 0.4, e: 0.8 }], 0, 1)).toBeCloseTo(0.6);
  });

  it('subtracts the cuts from the range', () => {
    expect(keptLength([{ s: 0.4, e: 0.5 }], 0.2, 0.8)).toBeCloseTo(0.5);
  });

  it('never goes negative when a span covers the whole range', () => {
    expect(keptLength([{ s: 0, e: 1 }], 0.2, 0.8)).toBe(0);
  });
});
