// Recording clock (main timer + mirrored badge clock).

import { el } from './dom.js';
import { app } from '../state.js';

function mmss(ms) {
  const s = Math.floor(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

export function startTimer() {
  app.timerIv = setInterval(() => {
    const ms = Date.now() - app.startAt;
    setTimerMs(ms);
    el.recClock.textContent = mmss(ms);
  }, 50);
}

export function stopTimer() {
  clearInterval(app.timerIv);
  app.timerIv = null;
}

export function setTimerMs(ms) {
  const dec = Math.floor((ms % 1000) / 10);
  el.tmr.textContent   = mmss(ms);
  el.tmrMs.textContent = String(dec).padStart(2, '0');
}
