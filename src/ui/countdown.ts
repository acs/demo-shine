// The 3-2-1 countdown overlay shown between "record" and recording.
// It can be cancelled from outside — the user pressing record again during it.
//
// It is one gesture, so it is one object: it knows whether it is running, whether
// it was cancelled, and where the app was when it was started — which is what a
// cancelled countdown has to return to. The caller is told whether it finished,
// rather than being handed a second flag to keep in step with this one.

import type { Phase } from '../state.js';
import { el } from './dom.js';
import { sleep } from '../util.js';

export class Countdown {
  private running = false;
  private cancelled = false;
  private from: Phase = 'live';

  /** Is the 3-2-1 on screen? */
  get active(): boolean {
    return this.running;
  }

  /** The phase a cancelled countdown goes back to: where it was started from. */
  get returnsTo(): Phase {
    return this.from;
  }

  /**
   * Run the countdown for a take being set up, and say whether it finished —
   * false when someone cancelled it, in which case the take does not happen.
   */
  async run(from: Phase): Promise<boolean> {
    this.from = from;
    this.cancelled = false;
    this.running = true;
    el.cdOv.style.display = 'flex';
    for (let i = 3; i >= 1 && !this.cancelled; i--) {
      el.cdNum.textContent = String(i);
      el.cdNum.style.animation = 'none';
      void el.cdNum.offsetHeight;
      el.cdNum.style.animation = 'cd-pop .95s ease-out forwards';
      await sleep(1000);
    }
    el.cdOv.style.display = 'none';
    this.running = false;
    return !this.cancelled;
  }

  /**
   * Stop it: the overlay goes, the run in hand will say it did not finish, and it
   * is no longer running from this moment rather than up to a second later. One
   * countdown at a time is the caller's business — the phase it sets says so.
   */
  cancel(): void {
    if (!this.running) return;
    this.cancelled = true;
    this.running = false;
    el.cdOv.style.display = 'none';
  }
}

export const countdown = new Countdown();
