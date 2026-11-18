import { describe, expect, it } from 'vitest';

import { Span } from '../clip/Span.js';
import { AnnotationSet } from './AnnotationSet.js';
import { Arrow } from './Arrow.js';
import type { Annotation } from './Annotation.js';

const note = (id: string, s: number, e: number): Annotation => {
  const arrow = Arrow.create(Span.of(s, e), { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }, id);
  if (!arrow) throw new Error('the test arrow should be usable');
  return arrow;
};

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

  it('re-bases every span when the clip grows, keeping each one an annotation', () => {
    const grown = AnnotationSet.EMPTY.add(note('a', 0.5, 0.6)).rebase(0.5);
    const one = grown.byId('a');
    expect(one?.span.s).toBeCloseTo(0.25);
    expect(one?.span.e).toBeCloseTo(0.3);
    expect(one?.kind).toBe('arrow');                  // still the class, not a bare object
    expect(typeof one?.stored).toBe('function');
  });
});
