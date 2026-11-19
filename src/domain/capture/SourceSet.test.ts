import { describe, expect, it } from 'vitest';
import { SourceSet } from './SourceSet.js';

describe('SourceSet', () => {
  it('starts with nothing on', () => {
    expect(SourceSet.NONE.any).toBe(false);
    expect(SourceSet.NONE.hasPicture).toBe(false);
  });

  it('needs a picture for a take', () => {
    expect(SourceSet.of(true, false, false).hasPicture).toBe(true);
    expect(SourceSet.of(false, true, false).hasPicture).toBe(true);
    expect(SourceSet.of(false, false, true).hasPicture).toBe(false);
  });

  it('keeps the three toggles independent', () => {
    const all = SourceSet.NONE.withScreen(true).withWebcam(true).withMic(true);
    expect(all.screen).toBe(true);
    expect(all.webcam).toBe(true);
    expect(all.mic).toBe(true);

    const screenOnly = all.withWebcam(false).withMic(false);
    expect(screenOnly.screen).toBe(true);
    expect(screenOnly.webcam).toBe(false);
    expect(screenOnly.mic).toBe(false);
  });

  it('shares the empty set', () => {
    expect(SourceSet.of(false, false, false)).toBe(SourceSet.NONE);
  });

  it('compares by value', () => {
    expect(SourceSet.of(true, false, true).equals(SourceSet.of(true, false, true))).toBe(true);
    expect(SourceSet.of(true, false, false).equals(SourceSet.NONE)).toBe(false);
  });
});
