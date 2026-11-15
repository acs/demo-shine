import { describe, expect, it } from 'vitest';

import { Clip, type ClipEvent } from './Clip.js';
import { Span } from './Span.js';
import { Trim } from './Trim.js';
import { Take } from './Take.js';
import type { TakeRepository } from './TakeRepository.js';

// The port is what makes this possible: the aggregate is tested with the smallest
// collection that behaves like the real one, and nothing here touches a browser.
class FakeTakes implements TakeRepository {
  private takes: Take[] = [];

  add(blob: Blob, duration: number): Take {
    const take = Take.of(this.takes.length + 1, blob, `blob:${this.takes.length + 1}`, duration);
    this.takes.push(take);
    return take;
  }
  all() { return this.takes; }
  at(index: number) { return this.takes[index]; }
  count() { return this.takes.length; }
  isEmpty() { return !this.takes.length; }
  startOf(index: number) { let at = 0; for (let i = 0; i < index && i < this.takes.length; i++) at += this.takes[i].duration; return at; }
  indexAt(seconds: number) {
    for (let i = 0; i < this.takes.length; i++) if (seconds < this.startOf(i) + this.takes[i].duration) return i;
    return Math.max(0, this.takes.length - 1);
  }
  totalDuration() { return this.takes.reduce((total, take) => total + take.duration, 0); }
  clear() { this.takes = []; }
}

const clipOf = (...durations: number[]): Clip => {
  const clip = Clip.empty(new FakeTakes());
  for (const seconds of durations) clip.addTake(new Blob(['x']), seconds);
  return clip;
};

describe('Clip', () => {
  it('is as long as its takes, without ever being told', () => {
    const clip = clipOf(3, 4);
    expect(clip.total()).toBe(7);
    expect(clip.takes.count()).toBe(2);
  });

  it('takes a cut out of the timeline, and says what that was worth', () => {
    const clip = clipOf(10);
    expect(clip.approve(Span.of(0.2, 0.3))).toBeCloseTo(1);
    expect(clip.keptLength()).toBeCloseTo(9);
    expect(clip.cuts.spans.length).toBe(1);
  });

  it('puts the last one back, once, and says which it was', () => {
    const clip = clipOf(10);
    clip.approve(Span.of(0.2, 0.3));
    expect(clip.undo()?.equals(Span.of(0.2, 0.3))).toBe(true);
    expect(clip.keptLength()).toBeCloseTo(10);
    expect(clip.canUndo()).toBe(false);
    expect(clip.undo()).toBeNull();
  });

  it('remembers what the last trim was worth, for the timeline to say', () => {
    const clip = clipOf(10);
    clip.approve(Span.of(0.1, 0.2));
    expect(clip.canUndo()).toBe(true);
    expect(clip.lastRemoved()).toBeCloseTo(1);
  });

  it('keeps a cut over its moment when the clip grows', () => {
    const clip = clipOf(10);
    clip.approve(Span.of(0.5, 0.6));            // 5s-6s
    clip.addTake(new Blob(['x']), 10);          // now 20s of clip
    expect(clip.cuts.spans[0].s).toBeCloseTo(0.25);
    expect(clip.cuts.spans[0].e).toBeCloseTo(0.3);
    expect(clip.keptLength()).toBeCloseTo(19);  // 20s of clip, the same 1s still gone
    expect(clip.canUndo()).toBe(false);         // measured against a clip that moved
  });

  it('counts only what the keep range holds', () => {
    const clip = clipOf(10);
    clip.keepRange(Trim.of(0.5, 1));
    expect(clip.keptLength()).toBeCloseTo(5);
  });

  it('says what an export is made of: the kept stretches, take by take', () => {
    expect(clipOf(3, 3).segmentsIn(0, 6).map(s => [s.takeIndex, s.from, s.to]))
      .toEqual([[0, 0, 3], [1, 3, 6]]);
  });

  it('and leaves the trimmed stretches out of them, closing the gap', () => {
    const clip = clipOf(3, 3);
    clip.approve(Span.of(0.7, 0.8));            // 4.2s-4.8s of the 6s clip
    expect(clip.segmentsIn(0, 6).map(s => [s.takeIndex, +s.from.toFixed(2), +s.to.toFixed(2)]))
      .toEqual([[0, 0, 3], [1, 3, 4.2], [1, 4.8, 6]]);
  });

  it('empties itself: the takes, the cuts and the keep range', () => {
    const clip = clipOf(4);
    clip.approve(Span.of(0.1, 0.2));
    clip.keepRange(Trim.of(0.2, 0.8));
    clip.clear();
    expect(clip.total()).toBe(0);
    expect(clip.keptLength()).toBe(0);
    expect(clip.cuts.isEmpty).toBe(true);
    expect(clip.trim.start).toBe(0);
    expect(clip.canUndo()).toBe(false);
  });
});

describe('Clip, announcing what changed', () => {
  it('says a take arrived, with where it landed and how long the clip was before', () => {
    const clip = Clip.empty(new FakeTakes());
    const seen: ClipEvent[] = [];
    clip.onChange(event => seen.push(event));
    clip.addTake(new Blob(['x']), 3);
    clip.addTake(new Blob(['x']), 4);
    expect(seen).toEqual([
      { type: 'take-added', take: clip.takes.at(0), index: 0, previousTotal: 0 },
      { type: 'take-added', take: clip.takes.at(1), index: 1, previousTotal: 3 },
    ]);
  });

  it('says a cut was approved, what it was worth, and that it went back', () => {
    const clip = clipOf(10);
    const seen: ClipEvent[] = [];
    clip.onChange(event => seen.push(event));
    clip.approve(Span.of(0.2, 0.3));
    clip.undo();
    expect(seen.map(e => e.type)).toEqual(['trim-approved', 'trim-undone']);
    expect(seen[0]).toMatchObject({ removed: 1 });
    const undone = seen[1] as { cut: Span };
    expect(undone.cut.equals(Span.of(0.2, 0.3))).toBe(true);
  });

  it('says the handles moved, and that the session was dropped', () => {
    const clip = clipOf(4);
    const seen: string[] = [];
    clip.onChange(event => seen.push(event.type));
    clip.keepRange(Trim.of(0.2, 0.8));
    clip.clear();
    expect(seen).toEqual(['keep-range', 'cleared']);
  });

  it('lets a listener stop listening', () => {
    const clip = clipOf(4);
    const seen: string[] = [];
    const stop = clip.onChange(event => seen.push(event.type));
    clip.approve(Span.of(0.1, 0.2));
    stop();
    clip.approve(Span.of(0.3, 0.4));
    expect(seen).toEqual(['trim-approved']);
  });
});
