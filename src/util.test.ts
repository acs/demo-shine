import { describe, expect, it } from 'vitest';

import { clampToClip } from './util.js';

describe('clampToClip', () => {
  it('keeps a position inside the range', () => {
    expect(clampToClip(5, 0, 10)).toBe(5);
  });

  it('pulls one that is outside back to the edge it left', () => {
    expect(clampToClip(-4, 0, 10)).toBe(0);
    expect(clampToClip(99, 0, 10)).toBe(10);
  });
});
