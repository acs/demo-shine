import { describe, expect, it } from 'vitest';

import { Span } from '../clip/Span.js';
import { TextAnnotation, type TextGeometry } from './TextAnnotation.js';
import type { Annotation, StoredAnnotation } from './Annotation.js';

const span = Span.of(0.2, 0.4);

const geo = (over: Partial<TextGeometry> = {}): TextGeometry => ({
  text: 'Hello', x: 0.2, y: 0.2, width: 0.2, height: 0.1,
  ...over,
});

const make = (over: Partial<TextGeometry> = {}): TextAnnotation => {
  const text = TextAnnotation.create(span, geo(over));
  if (!text) throw new Error('the test text should be usable');
  return text;
};

describe('the text annotation', () => {
  it('pulls the whole box inside the picture, and keeps its kind and stretch', () => {
    const text = TextAnnotation.create(span, geo({ x: 1.5, y: -0.5, width: 0.3, height: 0.4 }));
    expect(text?.geometry).toMatchObject({ x: 0.7, y: 0, width: 0.3, height: 0.4 });
    expect(text?.kind).toBe('text');
    expect(text?.span.equals(span)).toBe(true);
  });

  it('refuses nothing to say, and a box too small to draw', () => {
    expect(TextAnnotation.create(span, geo({ text: '' }))).toBeNull();
    expect(TextAnnotation.create(span, geo({ text: '   ' }))).toBeNull();
    expect(TextAnnotation.create(span, geo({ width: 0.005 }))).toBeNull();
  });

  it('gives the four corners to take hold of', () => {
    const corners = make({ x: 0.2, y: 0.2, width: 0.3, height: 0.1 }).handles();
    expect(corners.map(c => c.end)).toEqual(['nw', 'ne', 'se', 'sw']);
    const expected = [[0.2, 0.2], [0.5, 0.2], [0.5, 0.3], [0.2, 0.3]];
    corners.forEach((c, i) => {
      expect(c.x).toBeCloseTo(expected[i][0]);
      expect(c.y).toBeCloseTo(expected[i][1]);
    });
  });

  it('scales the box — and so the text — from the opposite corner', () => {
    const text = make({ x: 0.2, y: 0.2, width: 0.2, height: 0.1 });
    // se dragged to (0.5, 0.5): width wants x1.5, height wants x3 — the smaller fits.
    const scaled = text.withHandle('se', { x: 0.5, y: 0.5 })!;
    expect(scaled.geometry.width).toBeCloseTo(0.3);
    expect(scaled.geometry.height).toBeCloseTo(0.15);
    expect(scaled.geometry.x).toBeCloseTo(0.2);        // nw is the anchor
    expect(scaled.geometry.y).toBeCloseTo(0.2);
    // both scaled by the same factor, so the text's shape is kept
    expect(scaled.geometry.width / scaled.geometry.height).toBeCloseTo(0.2 / 0.1);
  });

  it('does not stretch when told to resize freely', () => {
    // The canvas hands every kind `{ free }` when a modifier is held; text ignores it.
    const text = make();
    const viaBase: Annotation = text;
    const free = viaBase.withHandle('se', { x: 0.5, y: 0.5 }, { free: true });
    const proportional = text.withHandle('se', { x: 0.5, y: 0.5 });
    expect(free?.stored().geometry).toEqual(proportional?.stored().geometry);
  });

  it('anchors each corner on its opposite', () => {
    const base = { x: 0.2, y: 0.2, width: 0.2, height: 0.1 };
    const nw = make(base).withHandle('nw', { x: 0.1, y: 0.1 })!.geometry;
    expect(nw.x + nw.width).toBeCloseTo(0.4);          // se fixed
    expect(nw.y + nw.height).toBeCloseTo(0.3);
    const ne = make(base).withHandle('ne', { x: 0.5, y: 0.1 })!.geometry;
    expect(ne.x).toBeCloseTo(0.2);                      // sw fixed
    expect(ne.y + ne.height).toBeCloseTo(0.3);
    const sw = make(base).withHandle('sw', { x: 0.1, y: 0.4 })!.geometry;
    expect(sw.x + sw.width).toBeCloseTo(0.4);           // ne fixed
    expect(sw.y).toBeCloseTo(0.2);
    expect(make(base).withHandle('nowhere', { x: 0, y: 0 })).toBeNull();
  });

  it('clamps a drag past the anchor rather than flipping the box', () => {
    const text = make();
    const shrunk = text.withHandle('se', { x: 0.1, y: 0.1 });
    expect(shrunk).not.toBeNull();
    expect(shrunk?.geometry.width).toBeGreaterThan(0);
    expect(shrunk?.geometry.x).toBeCloseTo(0.2);
  });

  it('moves whole, pulled back inside the picture', () => {
    const moved = make({ x: 0.2, y: 0.2, width: 0.2, height: 0.1 }).movedBy(0.9, 0)?.geometry;
    expect(moved?.x).toBeCloseTo(0.8);                  // 1 - width
    expect(moved?.y).toBeCloseTo(0.2);
  });

  it('follows a clip that grew, keeping what it says', () => {
    const grown = make().withSpan(Span.of(0.1, 0.2));
    expect(grown.span.s).toBeCloseTo(0.1);
    expect(grown.geometry).toEqual(make().geometry);
  });

  it('copies itself as new text over the stretch it is given', () => {
    const text = make();
    const copy = text.duplicated(Span.of(0.6, 0.8));
    expect(copy.id).not.toBe(text.id);
    expect(copy.geometry.text).toBe('Hello');
    expect(copy.geometry).toEqual(text.geometry);
    expect(copy.span.s).toBeCloseTo(0.6);
  });

  it('knows when a point is inside its box', () => {
    const text = make({ x: 0.2, y: 0.2, width: 0.2, height: 0.1 });
    expect(text.hitTest(0.3, 0.25)).toBe(true);
    expect(text.hitTest(0.6, 0.25)).toBe(false);
  });

  it('writes itself down and reads itself back', () => {
    const text = make();
    const stored = text.stored();
    expect(stored).toMatchObject({ id: text.id, kind: 'text', s: 0.2, e: 0.4 });
    expect(TextAnnotation.restore(stored)?.geometry).toEqual(text.geometry);
    expect(TextAnnotation.restore(stored)?.id).toBe(text.id);
  });

  it('reads a damaged one back as nothing, rather than throwing', () => {
    expect(TextAnnotation.restore({ id: 'z', kind: 'text', s: 0, e: 0.1, geometry: null } as StoredAnnotation)).toBeNull();
    expect(TextAnnotation.restore({ id: 'z', kind: 'text', s: 0, e: 0.1, geometry: { text: '' } } as unknown as StoredAnnotation)).toBeNull();
  });
});