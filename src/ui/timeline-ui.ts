// Timeline panel: trim handles, time labels, size estimate, GIF warning and
// the thumbnail strip.

import { el } from './dom.js';
import { app } from '../state.js';
import { clipSeconds, normalizeTrim, estimateWebmText, estimateGifText } from '../domain/timeline.js';
import { seekTo } from './preview.js';
import { syncToTrim, seekPlayback } from './playback.js';

export function resetTrim(): void {
  app.trimStart = 0;
  app.trimEnd = 1;
  el.rStart.value = '0';
  el.rEnd.value = '1000';
  updateTrimUI();
}

export function onTrim(evt: { target: EventTarget | null }): void {
  const moved: 'start' | 'end' = evt.target === el.rStart ? 'start' : 'end';
  const { s, en } = normalizeTrim(parseInt(el.rStart.value), parseInt(el.rEnd.value), moved);
  if (s  !== parseInt(el.rStart.value)) el.rStart.value = String(s);
  if (en !== parseInt(el.rEnd.value))   el.rEnd.value   = String(en);
  app.trimStart = s / 1000;
  app.trimEnd   = en / 1000;
  updateTrimUI();
  updateSizeUI();
  checkGifWarning();
  syncToTrim(moved);
}

export function updateTrimUI(): void {
  const s = app.trimStart * app.duration;
  const e = app.trimEnd * app.duration;
  el.tIn.textContent   = s.toFixed(2) + 's';
  el.tOut.textContent  = e.toFixed(2) + 's';
  el.tClip.textContent = (e - s).toFixed(2) + 's';
  el.rFill.style.left  = (app.trimStart * 100).toFixed(1) + '%';
  el.rFill.style.width = ((app.trimEnd - app.trimStart) * 100).toFixed(1) + '%';
}

export function updateSizeUI(): void {
  if (!app.duration || app.phase === 'idle') { el.tSize.textContent = '—'; return; }
  const clip = clipSeconds(app.duration, app.trimStart, app.trimEnd);
  if (app.fmt === 'gif') {
    const fps = parseInt(el.gFps.value) || 12;
    el.tSize.textContent = estimateGifText(clip, fps, app.captureW, app.captureH);
  } else {
    el.tSize.textContent = estimateWebmText(clip);
  }
}

export function checkGifWarning(): void {
  const clip = clipSeconds(app.duration, app.trimStart, app.trimEnd);
  const warn = app.fmt === 'gif' && clip > 30;
  el.gifWarn.style.display = warn ? '' : 'none';
  if (warn) {
    el.btnExp.classList.remove('export');
    el.btnExp.classList.add('warn-export');
  } else {
    el.btnExp.classList.add('export');
    el.btnExp.classList.remove('warn-export');
  }
}

export async function buildThumbs(): Promise<void> {
  el.thumbs.innerHTML = '';
  const COUNT = 22;
  const frames: Array<{ tc: HTMLCanvasElement }> = [];
  for (let i = 0; i < COUNT; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'thumb-frame';
    const tc = document.createElement('canvas');
    tc.width = 80; tc.height = 45;
    wrap.appendChild(tc);
    el.thumbs.appendChild(wrap);
    frames.push({ tc });
    const pct = i / COUNT;
    wrap.addEventListener('click', () => {
      if (app.phase !== 'review' || el.rv.readyState < 2) return;
      const t = pct * app.duration;
      el.rStart.value = String(Math.min(Math.floor(pct * 1000), parseInt(el.rEnd.value) - 10));
      onTrim({ target: el.rStart });
      if (app.playing) seekPlayback(t);
    });
  }
  for (let i = 0; i < COUNT; i++) {
    await seekTo(el.rv, (i / COUNT) * app.duration);
    frames[i].tc.getContext('2d')?.drawImage(el.rv, 0, 0, 80, 45);
  }
}
