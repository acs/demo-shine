// The 3-2-1 countdown overlay shown between "pick a display" and recording.

import { el } from './dom.js';
import { sleep } from '../util.js';

export async function runCountdown() {
  el.cdOv.style.display = 'flex';
  for (let i = 3; i >= 1; i--) {
    el.cdNum.textContent = i;
    el.cdNum.style.animation = 'none';
    void el.cdNum.offsetHeight;
    el.cdNum.style.animation = 'cd-pop .95s ease-out forwards';
    await sleep(1000);
  }
  el.cdOv.style.display = 'none';
}
