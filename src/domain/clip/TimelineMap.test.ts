import { describe, expect, it } from 'vitest';

import { Span } from './Span.js';
import { TimelineMap } from './TimelineMap.js';

describe('TimelineMap', () => {
  const clip = (cuts: Array<{ s: number; e: number }>) => TimelineMap.forClip(cuts, 10);

  it('gives cuts given as fractions of the clip in seconds', () => {
    expect(clip([{ s: 0.2, e: 0.3 }]).cuts[0].equals(Span.of(2, 3))).toBe(true);
  });

  it('leaves the kept length of a range, and of the whole clip', () => {
    expect(clip([{ s: 0.2, e: 0.3 }]).keptLength(0, 10)).toBeCloseTo(9);
    expect(clip([{ s: 0.2, e: 0.3 }]).kept).toBeCloseTo(9);
    expect(clip([{ s: 0.2, e: 0.3 }]).keptLength(1, 4)).toBeCloseTo(2);
  });

  it('maps a moment of the recording to the timeline and back', () => {
    const map = clip([{ s: 0.2, e: 0.3 }]);          // 2s-3s of 10s removed
    expect(map.keptOf(1)).toBeCloseTo(1);
    expect(map.keptOf(5)).toBeCloseTo(4);
    expect(map.sourceOf(4)).toBeCloseTo(5);
    expect(map.sourceOf(1)).toBeCloseTo(1);
  });

  it('gives the time before a cut, and the time after it', () => {
    const map = clip([{ s: 0.2, e: 0.3 }]);
    expect(map.keptOf(2)).toBeCloseTo(2);            // the edge itself: before it
    expect(map.sourceOf(2)).toBeCloseTo(3);          // the same point on the timeline: after it
  });

  it('never runs below zero, and keeps counting past the end', () => {
    const map = clip([{ s: 0, e: 0.5 }]);
    expect(map.keptOf(1)).toBe(0);
    expect(clip([]).sourceOf(99)).toBe(99);
  });

  it('knows a moment inside a cut, and where to jump to leave it', () => {
    const map = clip([{ s: 0.2, e: 0.3 }]);
    expect(map.contains(2.5)).toBe(true);
    expect(map.endAt(2.5)).toBeCloseTo(3);
    expect(map.endAt(5)).toBeNull();
  });

  it('gives a position on the timeline as a fraction of the recording', () => {
    const map = clip([{ s: 0.2, e: 0.3 }]);          // 2s-3s of a 10s recording
    expect(map.sourceFraction(0)).toBeCloseTo(0);
    expect(map.sourceFraction(5)).toBeCloseTo(0.6);  // 5s on the timeline is 6s of it
    expect(map.sourceFraction(99)).toBeCloseTo(1);   // held inside the recording
    expect(map.sourceFraction(-4)).toBeCloseTo(0);
  });

  it('says nothing when there is no recording to be a fraction of', () => {
    expect(TimelineMap.none(0).sourceFraction(3)).toBe(0);
  });

  it('is the whole clip when nothing was removed', () => {
    const map = TimelineMap.none(10);
    expect(map.kept).toBe(10);
    expect(map.cuts.length).toBe(0);
    expect(map.keptOf(4)).toBe(4);
  });
});
