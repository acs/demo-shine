// The surface's transport operations: move the playhead, play, pause.
//
// They are the app's own transport, reached through the same object the ▶ button and
// the keyboard use, so a seek an agent asks for is the seek a person gets. The app's
// rule holds: the transport means something in the review, and nowhere else — so
// outside it the surface refuses with a reason rather than reporting success for
// something that did not happen.

import type { Result } from './surface.js';

/** What the surface needs of the app's transport; `Playback` satisfies it. */
export interface Transport {
  seek(seconds: number): void;
  start(): void;
  pause(): void;
}

export interface Viewer {
  seek(seconds: number): Result<{ at: number }>;
  play(): Result;
  pause(): Result;
}

export function createViewer(
  transport: Transport,
  phase: () => string,
  length: () => number,
): Viewer {
  const notInReview = (): { ok: false; reason: string } | null =>
    phase() === 'review' ? null : { ok: false, reason: 'the clip is not in the review, so the transport means nothing yet' };

  return {
    seek(seconds) {
      const notNow = notInReview();
      if (notNow) return notNow;
      if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
        return { ok: false, reason: 'a seek needs a number of seconds' };
      }
      const total = length();
      if (!(total > 0)) return { ok: false, reason: 'there is no clip to seek in' };
      const at = Math.max(0, Math.min(total, seconds));
      transport.seek(at);
      return { ok: true, at };
    },

    play() {
      const notNow = notInReview();
      if (notNow) return notNow;
      transport.start();
      return { ok: true };
    },

    pause() {
      const notNow = notInReview();
      if (notNow) return notNow;
      transport.pause();
      return { ok: true };
    },
  };
}
