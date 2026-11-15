// Timeline panel: trim handles, time labels, size estimate and the thumbnail
// strip.

import { el } from './dom.js';
import { app } from '../state.js';
import { keptLength, normalizeTrim, estimateWebmText } from '../domain/timeline.js';
import { clipSeek } from './clip.js';
import { syncToTrim } from './playback.js';
import { drawWaveform } from './waveform.js';

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
  syncToTrim(moved);
  drawWaveform();
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
  // Cuts are trimmed away, so they shrink the estimate too.
  const clip = keptLength(app.cuts, app.trimStart, app.trimEnd) * app.duration;
  el.tSize.textContent = estimateWebmText(clip);
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
  }
  for (let i = 0; i < COUNT; i++) {
    await clipSeek((i / COUNT) * app.duration);
    frames[i].tc.getContext('2d')?.drawImage(el.rv, 0, 0, 80, 45);
  }
}
