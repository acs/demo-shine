import { describe, expect, it, vi } from 'vitest';

import { TakeRepository } from './takes.js';

describe('TakeRepository', () => {
  const blob = (s: string) => new Blob([s]);

  it('numbers the takes as they arrive, and keeps their order', () => {
    const takes = new TakeRepository();
    const a = takes.add(blob('a'), 2);
    const b = takes.add(blob('b'), 3);
    expect([a.id, b.id]).toEqual([1, 2]);
    expect(takes.all().map(t => t.id)).toEqual([1, 2]);
  });

  it('gives each take a URL that plays its own bytes', () => {
    const takes = new TakeRepository();
    const one = takes.add(blob('one'), 1);
    const two = takes.add(blob('two'), 1);
    expect(one.url).toMatch(/^blob:/);
    expect(one.url).not.toBe(two.url);
  });

  it('knows how many there are, how long they add up to, and which is where', () => {
    const takes = new TakeRepository();
    expect(takes.isEmpty()).toBe(true);
    expect(takes.count()).toBe(0);
    expect(takes.totalDuration()).toBe(0);
    takes.add(blob('a'), 2.5);
    takes.add(blob('b'), 3.5);
    expect(takes.isEmpty()).toBe(false);
    expect(takes.count()).toBe(2);
    expect(takes.totalDuration()).toBeCloseTo(6);
    expect(takes.at(1)?.duration).toBeCloseTo(3.5);
    expect(takes.at(9)).toBeUndefined();
  });

  it('revokes every URL when the session is dropped, and keeps none', () => {
    const revoked = vi.spyOn(URL, 'revokeObjectURL');
    const takes = new TakeRepository();
    const urls = [takes.add(blob('a'), 1).url, takes.add(blob('b'), 1).url];
    takes.clear();
    expect(revoked.mock.calls.map(c => c[0]).sort()).toEqual([...urls].sort());
    expect(takes.count()).toBe(0);
    expect(takes.totalDuration()).toBe(0);
    revoked.mockRestore();
  });
});
