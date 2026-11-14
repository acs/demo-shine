// Recording clock (main timer + mirrored badge clock).

import { el } from './dom.js';
import { app } from '../state.js';

function mmss(ms: number): string {
  const s = Math.floor(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

export function startTimer(): void {
  app.timerIv = setInterval(() => {
    const ms = Date.now() - (app.startAt ?? Date.now());
    setTimerMs(ms);
    el.recClock.textContent = mmss(ms);
  }, 50);
}

export function stopTimer(): void {
  clearInterval(app.timerIv ?? undefined);
  app.timerIv = null;
}

export function setTimerMs(ms: number): void {
  const dec = Math.floor((ms % 1000) / 10);
  el.tmr.textContent   = mmss(ms);
  el.tmrMs.textContent = String(dec).padStart(2, '0');
}
