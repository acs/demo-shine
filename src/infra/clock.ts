// The clock adapter: time and timers, so the use cases can be tested without them.

import type { ClockPort, Timer } from '../application/ports/ClockPort.js';

export class SystemClock implements ClockPort {
  now(): number {
    return Date.now();
  }

  setTimeout(callback: () => void, ms: number): Timer {
    const id = globalThis.setTimeout(callback, ms);
    return { cancel: () => globalThis.clearTimeout(id) };
  }
}

export const clock = new SystemClock();
