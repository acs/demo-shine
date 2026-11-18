import { describe, expect, it } from 'vitest';

import { Span } from '../clip/Span.js';
import { Arrow } from './Arrow.js';

const span = Span.of(0.2, 0.4);

const make = (from = { x: 0.1, y: 0.5 }, to = { x: 0.9, y: 0.5 }, id = 'a'): Arrow => {
  const arrow = Arrow.create(span, from, to, id);
  if (!arrow) throw new Error('the test arrow should be usable');
  return arrow;
};

describe('the arrow', () => {
  it('pulls both ends inside the picture, and keeps its kind and stretch', () => {
    const arrow = Arrow.create(span, { x: -1, y: 1.4 }, { x: 2, y: -1 });
    expect(arrow?.geometry).toEqual({ from: { x: 0, y: 1 }, to: { x: 1, y: 0 } });
    expect(arrow?.kind).toBe('arrow');
    expect(arrow?.span.equals(span)).toBe(true);
  });

  it('is not fooled by a NaN', () => {
    expect(make({ x: NaN, y: 0.5 }, { x: 5, y: -1 }).geometry)
      .toEqual({ from: { x: 0, y: 0.5 }, to: { x: 1, y: 0 } });
  });

  it('refuses a stray click', () => {
    expect(Arrow.create(span, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 })).toBeNull();
  });

  it('gives the two ends to take hold of', () => {
    expect(make().handles()).toEqual([
      { x: 0.1, y: 0.5, end: 'from' },
      { x: 0.9, y: 0.5, end: 'to' },
    ]);
  });

  it('aims and moves, keeping its identity', () => {
    const arrow = make();
    expect(arrow.withHandle('to', { x: 0.5, y: 0.2 })?.geometry.to).toEqual({ x: 0.5, y: 0.2 });
    expect(arrow.withHandle('from', { x: 0.3, y: 0.3 })?.geometry.from).toEqual({ x: 0.3, y: 0.3 });
    expect(arrow.withHandle('to', { x: 0.5, y: 0.2 })?.id).toBe('a');
    const moved = arrow.movedBy(0.05, 0)?.geometry;
    expect(moved?.from.x).toBeCloseTo(0.15);
    expect(moved?.to.x).toBeCloseTo(0.95);
    expect(moved?.from.y).toBeCloseTo(0.5);
  });

  it('cannot be aimed into nothing', () => {
    expect(make().withHandle('to', { x: 0.1, y: 0.5 })).toBeNull();
    expect(make().withHandle('nowhere', { x: 0, y: 0 })).toBeNull();
  });

  it('follows a clip that grew, keeping its shape', () => {
    const grown = make().withSpan(Span.of(0.1, 0.2));
    expect(grown.span.s).toBeCloseTo(0.1);
    expect(grown.geometry).toEqual({ from: { x: 0.1, y: 0.5 }, to: { x: 0.9, y: 0.5 } });
  });

  it('knows when a point is on it', () => {
    const arrow = make();      // a line across the middle of a 320x180 picture
    expect(arrow.hitTest(0.5, 0.5, 320, 180, 9)).toBe(true);
    expect(arrow.hitTest(0.5, 0.9, 320, 180, 9)).toBe(false);
  });

  it('writes itself down and reads itself back', () => {
    const arrow = make();
    const stored = arrow.stored();
    expect(stored).toMatchObject({ id: 'a', kind: 'arrow', s: 0.2, e: 0.4 });
    expect(Arrow.restore(stored)?.geometry).toEqual(arrow.geometry);
    expect(Arrow.restore(stored)?.id).toBe('a');
  });

  it('reads a damaged one back as nothing, rather than throwing', () => {
    expect(Arrow.restore({ id: 'z', kind: 'arrow', s: 0, e: 0.1, geometry: null })).toBeNull();
    expect(Arrow.restore({ id: 'z', kind: 'arrow', s: 0, e: 0.1, geometry: { from: {}, to: undefined } })).toBeNull();
  });
});
