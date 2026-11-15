import { describe, expect, it, vi } from 'vitest';

import { InMemoryTakeRepository } from './takes.js';

describe('InMemoryTakeRepository', () => {
  const blob = (s: string) => new Blob([s]);

  it('numbers the takes as they arrive, and keeps their order', () => {
    const takes = new InMemoryTakeRepository();
    const a = takes.add(blob('a'), 2);
    const b = takes.add(blob('b'), 3);
    expect([a.id, b.id]).toEqual([1, 2]);
    expect(takes.all().map(t => t.id)).toEqual([1, 2]);
  });

  it('gives each take a URL that plays its own bytes', () => {
    const takes = new InMemoryTakeRepository();
    const one = takes.add(blob('one'), 1);
    const two = takes.add(blob('two'), 1);
    expect(one.url).toMatch(/^blob:/);
    expect(one.url).not.toBe(two.url);
  });

  it('knows how many there are, how long they add up to, and which is where', () => {
    const takes = new InMemoryTakeRepository();
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

  it('says where each take begins, and which one holds a moment', () => {
    const takes = new InMemoryTakeRepository();
    takes.add(blob('a'), 2);
    takes.add(blob('b'), 3);
    expect(takes.startOf(0)).toBe(0);
    expect(takes.startOf(1)).toBeCloseTo(2);
    expect(takes.indexAt(1)).toBe(0);
    expect(takes.indexAt(2.5)).toBe(1);
    expect(takes.indexAt(99)).toBe(1);          // past the end: the last one
  });

  it('revokes every URL when the session is dropped, and keeps none', () => {
    const revoked = vi.spyOn(URL, 'revokeObjectURL');
    const takes = new InMemoryTakeRepository();
    const urls = [takes.add(blob('a'), 1).url, takes.add(blob('b'), 1).url];
    takes.clear();
    expect(revoked.mock.calls.map(c => c[0]).sort()).toEqual([...urls].sort());
    expect(takes.count()).toBe(0);
    expect(takes.totalDuration()).toBe(0);
    revoked.mockRestore();
  });
});
