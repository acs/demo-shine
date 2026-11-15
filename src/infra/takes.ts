// The session's recordings, and the browser handle that plays each one.
//
// In memory, on purpose: a session lives in the page and nothing is saved. What
// the repository is for is the object URL — making one when a take arrives, and
// revoking every one of them when the session is dropped. That used to be a
// parallel array of URLs inside the player and a `releaseParts()` the exporter
// also had to call, which is how you play a revoked URL or leak the ones nobody
// released.
//
// If sessions are ever persisted, this is the seam: the takes would be written
// and read back here, and nothing outside would have to know.

import { Take } from '../domain/clip/Take.js';

export class TakeRepository {
  private takes: Take[] = [];
  private nextId = 1;

  /** A new take at the end of the session, with the URL that plays it. */
  add(blob: Blob, duration: number): Take {
    const take = Take.of(this.nextId++, blob, URL.createObjectURL(blob), duration);
    this.takes.push(take);
    return take;
  }

  /** The takes in the order they were recorded. */
  all(): readonly Take[] {
    return this.takes;
  }

  /** By position on the joined timeline, which is the order they were recorded in. */
  at(index: number): Take | undefined {
    return this.takes[index];
  }

  count(): number {
    return this.takes.length;
  }

  isEmpty(): boolean {
    return this.takes.length === 0;
  }

  /** How long the joined clip is. */
  totalDuration(): number {
    return this.takes.reduce((total, take) => total + take.duration, 0);
  }

  /** The session is over: nothing is left holding its recordings alive. */
  clear(): void {
    for (const take of this.takes) URL.revokeObjectURL(take.url);
    this.takes = [];
  }
}
