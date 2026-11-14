// The 3-2-1 countdown overlay shown between "record" and recording.
// It can be cancelled from outside — the user pressing record again during it.

import { el } from './dom.js';
import { sleep } from '../util.js';

let cancelled = false;
let running = false;

export function cancelCountdown(): void {
  if (!running) return;
  cancelled = true;
  el.cdOv.style.display = 'none';
}

export async function runCountdown(): Promise<void> {
  cancelled = false;
  running = true;
  el.cdOv.style.display = 'flex';
  for (let i = 3; i >= 1 && !cancelled; i--) {
    el.cdNum.textContent = String(i);
    el.cdNum.style.animation = 'none';
    void el.cdNum.offsetHeight;
    el.cdNum.style.animation = 'cd-pop .95s ease-out forwards';
    await sleep(1000);
  }
  el.cdOv.style.display = 'none';
  running = false;
}
