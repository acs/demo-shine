import { describe, expect, it } from 'vitest';

import { Clipboard } from './annotation-clipboard.js';
import { Arrow } from '../../domain/annotation/Arrow.js';
import { Span } from '../../domain/clip/Span.js';

const arrow = (id: string, s: number, e: number): Arrow => {
  const made = Arrow.create(Span.of(s, e), { x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 }, id);
  if (!made) throw new Error('the test arrow should be usable');
  return made;
};

describe('the annotation clipboard', () => {
  it('holds nothing until something is copied', () => {
    const clipboard = new Clipboard();
    expect(clipboard.has).toBe(false);
    expect(clipboard.paste(Span.of(0, 0.1))).toBeNull();
    expect(clipboard.length).toBe(0);
  });

  it('pastes a new annotation like the held one, over the stretch it is given', () => {
    const clipboard = new Clipboard();
    clipboard.copy(arrow('a', 0.1, 0.3));
    const pasted = clipboard.paste(Span.of(0.6, 0.8));
    expect(pasted).not.toBeNull();
    expect(pasted?.id).not.toBe('a');                       // a new one, not the same one
    expect(pasted?.span.s).toBeCloseTo(0.6);
    expect(clipboard.length).toBeCloseTo(0.2);              // the held stretch's length
  });

  it('forgets what it held when the session ends', () => {
    const clipboard = new Clipboard();
    clipboard.copy(arrow('a', 0.1, 0.3));
    clipboard.clear();
    expect(clipboard.has).toBe(false);
  });
});
