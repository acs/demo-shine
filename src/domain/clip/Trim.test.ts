import { describe, expect, it } from 'vitest';

import { Trim } from './Trim.js';

describe('Trim', () => {
  it('keeps a valid range untouched', () => {
    expect(Trim.fromSlider(100, 800).normalized('start').slider).toEqual({ start: 100, end: 800 });
  });

  it('pushes IN back when the start handle crosses OUT', () => {
    const { start, end } = Trim.fromSlider(990, 1000).normalized('start').slider;
    expect(start).toBeCloseTo(1000 - Trim.MIN_GAP * Trim.SLIDER_MAX);
    expect(end).toBeCloseTo(1000);
  });

  it('pushes OUT forward when the end handle crosses IN', () => {
    const { start, end } = Trim.fromSlider(100, 105).normalized('end').slider;
    expect(start).toBeCloseTo(100);
    expect(end).toBeCloseTo(100 + Trim.MIN_GAP * Trim.SLIDER_MAX);
  });

  it('stays inside the clip', () => {
    expect(Trim.of(-1, 2).start).toBe(0);
    expect(Trim.of(-1, 2).end).toBe(1);
  });

  it('knows how long it is, in slider units and in seconds', () => {
    expect(Trim.fromSlider(0, 500).length).toBeCloseTo(0.5);
    expect(Trim.fromSlider(0, 500).seconds(120)).toBeCloseTo(60);
  });
});
