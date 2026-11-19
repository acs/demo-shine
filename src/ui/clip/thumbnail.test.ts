import { describe, expect, it } from 'vitest';
import { thumbBox } from './thumbnail.js';

describe('thumbBox', () => {
  it('leaves a 16:9 picture exactly as the strip has always drawn it', () => {
    expect(thumbBox(1280, 720)).toEqual({ w: 80, h: 45 });
  });

  it('keeps a crop\'s own shape, tall or wide, rather than 16:9', () => {
    expect(thumbBox(256, 720)).toEqual({ w: 28, h: 80 });   // a tall region
    expect(thumbBox(640, 180)).toEqual({ w: 80, h: 23 });   // a wide one
    expect(thumbBox(985, 611)).toEqual({ w: 80, h: 50 });   // an ordinary odd crop
  });

  it('never stretches: the box has the picture\'s aspect, to the pixel', () => {
    for (const [w, h] of [[1280, 720], [256, 720], [640, 180], [400, 800], [1920, 1080]]) {
      const box = thumbBox(w, h);
      // Whole pixels cannot hold every aspect exactly; a pixel either way is not a stretch.
      expect(Math.abs(box.w / box.h - w / h)).toBeLessThan(0.1);
    }
  });

  it('falls back to 16:9 when the picture has no size yet', () => {
    expect(thumbBox(0, 0)).toEqual({ w: 80, h: 45 });
    expect(thumbBox(Number.NaN, 720)).toEqual({ w: 80, h: 45 });
  });
});
