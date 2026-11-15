// Timeline panel: trim handles, time labels, size estimate and the thumbnail
// strip.

import { el } from './dom.js';
import { app } from '../state.js';
import { clipSeconds, normalizeTrim, estimateWebmText } from '../domain/timeline.js';
import { seekTo } from './preview.js';
import { syncToTrim, playFrom } from './playback.js';
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
  const clip = clipSeconds(app.duration, app.trimStart, app.trimEnd);
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
    await seekTo(el.rv, (i / COUNT) * app.duration);
    frames[i].tc.getContext('2d')?.drawImage(el.rv, 0, 0, 80, 45);
  }
}

// Click anywhere on the timeline track to start playing from that point. The
// header (labels, transport) and the trim handles keep their own behaviour.
export function initTimelineSeek(): void {
  el.timeline.addEventListener('click', evt => {
    if (app.phase !== 'review' || el.rv.readyState < 2) return;
    const target = evt.target as HTMLElement | null;
    if (target?.closest('.tl-header')) return;          // labels + play button
    if (target && (target.tagName === 'INPUT' || target.tagName === 'BUTTON')) return;

    const rect = el.thumbs.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = Math.max(0, Math.min(1, (evt.clientX - rect.left) / rect.width));
    // A click on the last couple of pixels means the OUT point: start over.
    const time = pct >= 1 - 2 / rect.width ? app.duration : pct * app.duration;
    playFrom(time);
  });
}
