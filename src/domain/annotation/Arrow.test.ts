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

  it('copies itself as a new arrow, over the stretch it is given', () => {
    const arrow = make();
    const copy = arrow.duplicated(Span.of(0.6, 0.8));
    expect(copy.id).not.toBe(arrow.id);
    expect(copy.kind).toBe('arrow');
    expect(copy.geometry).toEqual(arrow.geometry);
    expect(copy.span.s).toBeCloseTo(0.6);
    expect(copy.span.e).toBeCloseTo(0.8);
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

describe('the arrow colour', () => {
  it('is the arrow\'s red unless another is given', () => {
    expect(make().colour).toBe('#e53e3e');
    expect(Arrow.create(span, { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }, 'c', '#3182ce')?.colour).toBe('#3182ce');
  });

  it('keeps its colour when it is aimed, moved, stretched or copied', () => {
    const blue = Arrow.create(span, { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }, 'c', '#3182ce');
    if (!blue) throw new Error('the test arrow should be usable');
    expect(blue.withColour('#38a169').colour).toBe('#38a169');
    expect(blue.withHandle('to', { x: 0.5, y: 0.2 })?.colour).toBe('#3182ce');
    expect(blue.movedBy(0.05, 0)?.colour).toBe('#3182ce');
    expect(blue.withSpan(Span.of(0.1, 0.2)).colour).toBe('#3182ce');
    expect(blue.duplicated(Span.of(0.6, 0.8)).colour).toBe('#3182ce');
  });

  it('keeps its identity and shape when only the colour changes', () => {
    const arrow = make();
    const recoloured = arrow.withColour('#3182ce');
    expect(recoloured.id).toBe(arrow.id);
    expect(recoloured.geometry).toEqual(arrow.geometry);
    expect(recoloured.span.equals(arrow.span)).toBe(true);
  });

  it('writes the colour down and reads it back, defaulting when it is missing or unknown', () => {
    const blue = Arrow.create(span, { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }, 'c', '#3182ce');
    if (!blue) throw new Error('the test arrow should be usable');
    const stored = blue.stored();
    expect(Arrow.restore(stored)?.colour).toBe('#3182ce');
    expect(Arrow.restore({ ...stored, geometry: { from: { x: 0.1, y: 0.5 }, to: { x: 0.9, y: 0.5 } } })?.colour).toBe('#e53e3e');
    expect(Arrow.restore({ ...stored, geometry: { from: { x: 0.1, y: 0.5 }, to: { x: 0.9, y: 0.5 }, colour: 'red' } })?.colour).toBe('#e53e3e');
  });
});
