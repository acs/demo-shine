import { describe, expect, it } from 'vitest';

import {
  MIN_TRIM_GAP,
  clampToClip,
  clipSeconds,
  estimateGifText,
  estimateWebmText,
  normalizeTrim,
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

  it('formats a GIF estimate', () => {
    expect(estimateGifText(5, 12, 1280, 720)).toBe('~5.9 MB (GIF)');
  });
});
