import { describe, expect, it } from 'vitest';

import { COLOURS, colourOf } from './AnnotationColour.js';

describe('the annotation colour', () => {
  it('takes every colour the palette holds', () => {
    for (const colour of COLOURS) expect(colourOf(colour, COLOURS[0])).toBe(colour);
  });

  it('answers the fallback for anything that is not one of ours', () => {
    const junk: unknown[] = [undefined, null, '', 'red', '#123456', '#e53e3e00', 42, {}, [], true];
    for (const value of junk) expect(colourOf(value, '#ffffff')).toBe('#ffffff');
  });

  it('is not fooled by a near miss', () => {
    expect(colourOf('#E53E3E', '#ffffff')).toBe('#ffffff');   // case matters
    expect(colourOf(' #e53e3e', '#ffffff')).toBe('#ffffff');  // and so does the exact string
  });

  it('answers the fallback the kind gave it, not one of its own', () => {
    expect(colourOf('nonsense', '#111827')).toBe('#111827');
    expect(colourOf('nonsense', '#e53e3e')).toBe('#e53e3e');
  });
});