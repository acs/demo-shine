import { describe, expect, it } from 'vitest';

import { Span } from '../clip/Span.js';
import { createAnnotation, newAnnotationId } from './Annotation.js';

// Importing Annotation reaches kinds.ts, which registers the arrow: nothing here
// has to ask for it.

describe('createAnnotation', () => {
  it('normalises the geometry through its kind, on the way in', () => {
    const annotation = createAnnotation('arrow', Span.of(0.2, 0.4), {
      from: { x: -1, y: 0.5 },
      to: { x: 2, y: 0.5 },
    });
    expect(annotation?.geometry).toEqual({ from: { x: 0, y: 0.5 }, to: { x: 1, y: 0.5 } });
    expect(annotation?.span.equals(Span.of(0.2, 0.4))).toBe(true);
    expect(annotation?.kind).toBe('arrow');
  });

  it('refuses a kind this version does not know', () => {
    expect(createAnnotation('hologram', Span.of(0, 0.1), {})).toBeNull();
  });

  it('refuses a stray click, which is not worth keeping', () => {
    expect(createAnnotation('arrow', Span.of(0, 0.1), {
      from: { x: 0.5, y: 0.5 },
      to: { x: 0.5, y: 0.5 },
    })).toBeNull();
  });

  it('gives ids that do not repeat', () => {
    expect(new Set([newAnnotationId(), newAnnotationId(), newAnnotationId()]).size).toBe(3);
  });
});
