import { describe, expect, it } from 'vitest';

import { Session } from './Session.js';
import { Clip, type ClipEvent } from '../clip/Clip.js';
import { Take } from '../clip/Take.js';
import type { TakeRepository } from '../clip/TakeRepository.js';

// A collection that behaves like the app's without a browser.
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

const sessionWith = (durations: number[], audio = false): Session => {
  const clip = Clip.empty(new FakeTakes());
  for (const seconds of durations) clip.addTake(new Blob(['x']), seconds);
  return new Session(clip, audio);
};

describe('Session', () => {
  it('holds the clip and the audio flag', () => {
    const session = sessionWith([2], true);

    expect(session.clip.takes.count()).toBe(1);
    expect(session.audio).toBe(true);
  });

  it('ends by clearing the clip and the audio, as one event', () => {
    const session = sessionWith([2], true);
    const seen: ClipEvent[] = [];
    session.clip.onChange(event => seen.push(event));

    session.end();

    expect(session.clip.takes.isEmpty()).toBe(true);
    expect(session.audio).toBe(false);
    expect(seen.map(event => event.type)).toEqual(['cleared']);
  });

  it('holds no view state: ending it needs no view', () => {
    const session = sessionWith([2]);
    // Nothing but the clip and the audio flag is on the session.
    expect(Object.keys(session).sort()).toEqual(['audio', 'clip']);
  });
});
