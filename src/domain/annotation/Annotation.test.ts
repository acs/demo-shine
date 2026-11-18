import { describe, expect, it } from 'vitest';

import { newAnnotationId } from './Annotation.js';

describe('annotation identity', () => {
  it('gives ids that do not repeat', () => {
    expect(new Set([newAnnotationId(), newAnnotationId(), newAnnotationId()]).size).toBe(3);
  });

  it('gives one a restored annotation never has, because those carry their own', () => {
    expect(newAnnotationId()).not.toBe(newAnnotationId());
  });
});
