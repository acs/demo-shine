import { describe, expect, it } from 'vitest';

import { estimateWebmText } from './size-estimate.js';

describe('estimateWebmText', () => {
  it('gives a range, because the size depends on how much moves', () => {
    expect(estimateWebmText(10)).toBe('~1.0–5.5 MB (WebM)');
  });

  it('says nothing was measured as nothing', () => {
    expect(estimateWebmText(0)).toBe('~0.0–0.0 MB (WebM)');
  });
});
