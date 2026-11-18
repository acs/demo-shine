import { describe, expect, it } from 'vitest';

import { Span } from '../clip/Span.js';
import { AnnotationSet } from './AnnotationSet.js';
import { createAnnotation } from './Annotation.js';
import { kindOf, register, registeredKinds } from './kinds.js';
import type { AnnotationKind } from './kinds.js';

// A throwaway second kind, the one the seam exists for. It lives only in this test:
// registering it is what proves a new kind needs no change to the arrow.

interface Dot {
  x: number;
  y: number;
}

const dotKind: AnnotationKind<Dot> = {
  id: 'dot',
  defaultGeometry: () => ({ x: 0.5, y: 0.5 }),
  normalize: d => ({ x: Math.min(1, Math.max(0, d.x)), y: Math.min(1, Math.max(0, d.y)) }),
  isUsable: d => Number.isFinite(d.x) && Number.isFinite(d.y),
};

describe('the annotation family', () => {
  it('knows the arrow, and null for a kind it does not know', () => {
    expect(kindOf('arrow')?.id).toBe('arrow');
    expect(kindOf('hologram')).toBeNull();
  });

  it('takes a new kind without changing the arrow or the cuts', () => {
    const arrowBefore = createAnnotation('arrow', Span.of(0, 1), {
      from: { x: 0, y: 0.5 },
      to: { x: 1, y: 0.5 },
    });

    register(dotKind);
    expect(registeredKinds()).toContain('dot');

    // the arrow is exactly as it was
    expect(createAnnotation('arrow', Span.of(0, 1), {
      from: { x: 0, y: 0.5 },
      to: { x: 1, y: 0.5 },
    })?.geometry).toEqual(arrowBefore?.geometry);

    // and the new kind is generic through the same set
    const dot = createAnnotation('dot', Span.of(0.2, 0.3), { x: 2, y: -1 });
    expect(dot?.geometry).toEqual({ x: 1, y: 0 });
    const set = dot ? AnnotationSet.EMPTY.add(dot) : AnnotationSet.EMPTY;
    expect(set.at(0.25).map(a => a.kind)).toEqual(['dot']);
  });
});
