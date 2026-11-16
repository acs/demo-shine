import { describe, expect, it } from 'vitest';

import { AspectRatio } from './AspectRatio.js';

describe('AspectRatio', () => {
  it('is two whole sides of at least one', () => {
    const ratio = AspectRatio.of(1280, 720);
    expect(ratio.width).toBe(1280);
    expect(ratio.height).toBe(720);
  });

  it('refuses sides that are not whole numbers of pixels', () => {
    expect(() => AspectRatio.of(0, 720)).toThrow(/at least one/);
    expect(() => AspectRatio.of(1280, -1)).toThrow(/at least one/);
    expect(() => AspectRatio.of(16.5, 9)).toThrow(/whole/);
  });

  it('reduces to the smallest whole terms', () => {
    expect(AspectRatio.of(1280, 720).reduced().equals(AspectRatio.of(16, 9))).toBe(true);
    expect(AspectRatio.of(1920, 1080).reduced().equals(AspectRatio.of(16, 9))).toBe(true);
    expect(AspectRatio.of(1000, 1000).reduced().equals(AspectRatio.of(1, 1))).toBe(true);
    expect(AspectRatio.of(640, 480).reduced().equals(AspectRatio.of(4, 3))).toBe(true);
    expect(AspectRatio.of(7, 3).reduced().equals(AspectRatio.of(7, 3))).toBe(true);   // already prime
  });

  it('is the same ratio only when both sides match', () => {
    expect(AspectRatio.of(16, 9).equals(AspectRatio.of(16, 9))).toBe(true);
    expect(AspectRatio.of(16, 9).equals(AspectRatio.of(9, 16))).toBe(false);
  });
});
