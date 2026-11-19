import { describe, expect, it } from 'vitest';

import { currentPhase, onPhaseChange, setPhase } from './state.js';

// The phase module is a module-level singleton, so each test puts it back to idle
// and watches what its own change did.

describe('phase', () => {
  it('tells the watchers when the phase changes', () => {
    setPhase('idle');
    const seen: string[] = [];
    const stop = onPhaseChange(phase => seen.push(phase));

    setPhase('live');

    expect(seen).toEqual(['live']);
    expect(currentPhase()).toBe('live');

    stop();
    setPhase('idle');
  });

  it('says nothing when the phase is set to what it already is', () => {
    setPhase('review');
    const seen: string[] = [];
    const stop = onPhaseChange(phase => seen.push(phase));

    setPhase('review');

    expect(seen).toEqual([]);
    expect(currentPhase()).toBe('review');

    stop();
    setPhase('idle');
  });

  it('stops telling a watcher that has gone', () => {
    setPhase('idle');
    const seen: string[] = [];
    const stop = onPhaseChange(phase => seen.push(phase));

    stop();
    setPhase('live');

    expect(seen).toEqual([]);
    setPhase('idle');
  });
});
