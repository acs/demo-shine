import { describe, expect, it } from 'vitest';
import { CropRegion } from './CropRegion.js';

describe('CropRegion', () => {
  it('is the whole picture by default', () => {
    expect(CropRegion.FULL.isFull).toBe(true);
    expect(CropRegion.FULL.x).toBe(0);
    expect(CropRegion.FULL.w).toBe(1);
  });

  it('keeps a region inside the picture', () => {
    const region = CropRegion.of(0.1, 0.2, 0.5, 0.6);
    expect(region.x + region.w).toBeLessThanOrEqual(1);
    expect(region.y + region.h).toBeLessThanOrEqual(1);
  });

  it('refuses an empty region', () => {
    expect(() => CropRegion.of(0.1, 0.1, 0, 0.5)).toThrow('never empty');
    expect(() => CropRegion.of(0.1, 0.1, 0.5, -0.1)).toThrow('never empty');
  });

  it('refuses a region outside the picture', () => {
    expect(() => CropRegion.of(-0.1, 0, 0.5, 0.5)).toThrow('inside the picture');
    expect(() => CropRegion.of(0.8, 0, 0.5, 0.5)).toThrow('inside the picture');
  });

  it('refuses a non-finite number', () => {
    expect(() => CropRegion.of(Number.NaN, 0, 0.5, 0.5)).toThrow('finite');
  });

  it('recognises the whole picture however it was built', () => {
    expect(CropRegion.from(0, 0, 1, 1).isFull).toBe(true);
    expect(CropRegion.of(0, 0, 1, 1).isFull).toBe(true);
  });

  it('compares by value', () => {
    expect(CropRegion.of(0.1, 0.2, 0.3, 0.4).equals(CropRegion.of(0.1, 0.2, 0.3, 0.4))).toBe(true);
    expect(CropRegion.of(0.1, 0.2, 0.3, 0.4).equals(CropRegion.FULL)).toBe(false);
  });
});
