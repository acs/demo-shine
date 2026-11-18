import { describe, expect, it } from 'vitest';

import { arrowKind } from './Arrow.js';

describe('the arrow kind', () => {
  it('keeps an arrow drawn past the edge, pulled to the edge', () => {
    expect(arrowKind.normalize({ from: { x: -0.5, y: 1.4 }, to: { x: 2, y: -1 } }))
      .toEqual({ from: { x: 0, y: 1 }, to: { x: 1, y: 0 } });
  });

  it('is not fooled by a NaN', () => {
    expect(arrowKind.normalize({ from: { x: NaN, y: 0.5 }, to: { x: 5, y: -1 } }))
      .toEqual({ from: { x: 0, y: 0.5 }, to: { x: 1, y: 0 } });
  });

  it('refuses a stray click and keeps a real arrow', () => {
    expect(arrowKind.isUsable({ from: { x: 0.5, y: 0.5 }, to: { x: 0.5, y: 0.5 } })).toBe(false);
    expect(arrowKind.isUsable({ from: { x: 0.1, y: 0.5 }, to: { x: 0.9, y: 0.5 } })).toBe(true);
  });

  it('starts from a shape that is already usable', () => {
    expect(arrowKind.isUsable(arrowKind.normalize(arrowKind.defaultGeometry()))).toBe(true);
  });
});
