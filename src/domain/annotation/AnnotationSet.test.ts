import { describe, expect, it } from 'vitest';

import { Span } from '../clip/Span.js';
import { AnnotationSet } from './AnnotationSet.js';
import type { AnyAnnotation } from './Annotation.js';

const note = (id: string, s: number, e: number): AnyAnnotation =>
  ({ id, kind: 'arrow', span: Span.of(s, e), geometry: {} });

describe('AnnotationSet', () => {
  it('refuses a repeated id: an id appears once', () => {
    const set = AnnotationSet.EMPTY.add(note('a', 0, 0.5)).add(note('a', 0.6, 0.9));
    expect(set.count).toBe(1);
    expect(set.all[0].span.e).toBe(0.5);
  });

  it('lets two annotations overlap, unlike the cuts', () => {
    const set = AnnotationSet.EMPTY.add(note('a', 0, 0.6)).add(note('b', 0.4, 0.9));
    expect(set.count).toBe(2);
    expect(set.at(0.5).map(a => a.id)).toEqual(['a', 'b']);
  });

  it('orders what is shown at a moment by where the stretch starts', () => {
    const set = AnnotationSet.EMPTY.add(note('b', 0.4, 0.9)).add(note('a', 0.1, 0.6));
    expect(set.at(0.5).map(a => a.id)).toEqual(['a', 'b']);
    expect(set.at(0.95)).toEqual([]);
  });

  it('changes one in place, keeping its order, and removes one', () => {
    const set = AnnotationSet.EMPTY.add(note('a', 0, 0.5)).add(note('b', 0.5, 0.9));
    const moved = set.change('a', note('a', 0.2, 0.7));
    expect(moved.all.map(a => a.id)).toEqual(['a', 'b']);
    expect(moved.byId('a')?.span.s).toBe(0.2);
    expect(set.remove('a').all.map(a => a.id)).toEqual(['b']);
  });

  it('refuses a change or a removal for an id it does not hold', () => {
    const set = AnnotationSet.EMPTY.add(note('a', 0, 0.5));
    expect(set.change('nope', note('nope', 0, 1))).toBe(set);
    expect(set.remove('nope')).toBe(set);
  });

  it('re-bases every span when the clip grows', () => {
    const grown = AnnotationSet.EMPTY.add(note('a', 0.5, 0.6)).rebase(0.5);
    expect(grown.byId('a')?.span.s).toBeCloseTo(0.25);
    expect(grown.byId('a')?.span.e).toBeCloseTo(0.3);
  });
});
