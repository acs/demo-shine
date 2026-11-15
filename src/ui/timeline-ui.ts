// Timeline panel: trim handles, time labels, size estimate and the thumbnail
// strip.
//
// The timeline shows the clip with its approved trims taken out, so everything
// here is in timeline time — the handles, the labels and the strip are mapped
// through the kept-time mapping (clip.ts). The recording's own time is what playback
// and the export use.

import { clock, el } from './dom.js';
import { app } from '../state.js';
import { estimateWebmText } from './size-estimate.js';
import { Trim } from '../domain/clip/Trim.js';
import { keptLengthNow, keptOf, player, sourceOf } from './clip.js';
import { setTimerMs } from './timer.js';
import { playback } from './playback.js';
import { waveform } from './waveform.js';

const COUNT = 22;         // thumbnail frames across the strip

// The timeline is a view of the clip and nothing else, so the clip saying what
// changed is the whole of the coupling: an approved or undone trim re-cuts the
// strip, a new take and a dragged handle only move what is drawn from the model.
export function initTimeline(): void {
  app.clip.onChange(event => {
    if (event.type === 'trim-approved' || event.type === 'trim-undone') {
      void rebuildTimeline();     // the clip is a different length now
    }
    updateTrimUI();
    updateSizeUI();
    waveform.draw();
  });
}

export function onTrim(evt: { target: EventTarget | null }): void {
  const moved: 'start' | 'end' = evt.target === el.rStart ? 'start' : 'end';
  // The handles work in timeline units (0..1000 of what is left), so the model
  // keeps its own fractions of the recording.
  const { start: s, end: en } = Trim.fromSlider(parseInt(el.rStart.value), parseInt(el.rEnd.value)).normalized(moved).slider;
  app.clip.keepRange(Trim.of(handleFraction(s), handleFraction(en)));
  updateTrimUI(false);       // the handles are the authority while dragging
  updateSizeUI();
  playback.syncToTrim(moved);
  waveform.draw();
}

export function updateTrimUI(syncHandles = true): void {
  const kept = keptLengthNow();
  const s = keptOf(app.clip.trim.start * app.clip.total());
  const e = keptOf(app.clip.trim.end * app.clip.total());
  el.tIn.textContent   = s.toFixed(2) + 's';
  el.tOut.textContent  = e.toFixed(2) + 's';
  el.tClip.textContent = Math.max(0, e - s).toFixed(2) + 's';
  el.rFill.style.left  = pct(kept, s).toFixed(2) + '%';
  el.rFill.style.width = pct(kept, e - s).toFixed(2) + '%';
  if (syncHandles) {
    el.rStart.value = String(Math.round(pct(kept, s) * 10));
    el.rEnd.value   = String(Math.round(pct(kept, e) * 10));
  }
}

export function updateSizeUI(): void {
  if (!app.clip.total() || app.phase === 'idle') { el.tSize.textContent = '—'; return; }
  // Cuts are trimmed away, so they shrink the estimate too.
  const timeline = app.clip.timeline();
  const clip = timeline.keptLength(app.clip.trim.start * app.clip.total(), app.clip.trim.end * app.clip.total());
  el.tSize.textContent = estimateWebmText(clip);
}

// ── the export's progress ────────────────────────────────────────────────────
//
// The export plays the kept range into a canvas in real time, so the timeline
// shows it the way playback does: the playhead travels across the clip while the
// header counts down. `from` and `to` are times in the recording; the export runs
// at the clip's own speed, so what is left of the range is what is left to wait.

// The chip says what the clip holds. The export takes it over while it runs and
// puts it back afterwards, so what it said is the export's own business and it is
// handed back to it, rather than kept here for whoever asks next.
export function beginEncoding(): string {
  const was = el.tCut.textContent ?? '';
  el.timeline.classList.add('encoding');
  el.tlLabel.textContent = 'Timeline · Export';
  el.tCut.textContent = 'ENCODING';
  el.tLive.classList.remove('on');
  return was;
}

// The range is left as the review drew it: the export is shown the way playback
// is, by the playhead travelling across the clip, with the time left in the
// header. `to` is where the export ends; the export runs at the clip's own speed,
// so what is left of the range is what is left to wait.
export function encodingAt(source: number, to: number): void {
  const kept = Math.max(0.001, keptLengthNow());
  const head = keptOf(source), end = keptOf(to);
  el.playhead.style.left = ((head / kept) * 100).toFixed(2) + '%';
  el.tNow.textContent = head.toFixed(2) + 's';
  el.tCut.textContent = 'ENCODING · ' + clock(Math.max(0, end - head)) + ' left';
}

export function endEncoding(was: string): void {
  el.timeline.classList.remove('encoding');
  el.tlLabel.textContent = 'Timeline · Trim';
  el.tCut.textContent = was;
  updateTrimUI();              // the range and the head come back
}

// Everything that shows how long the clip is: the timeline changes length when a
// trim is approved or taken back, so it all has to be drawn again.
export function rebuildTimeline(): void {
  updateTrimUI();
  updateSizeUI();
  waveform.draw();
  setTimerMs(keptLengthNow() * 1000);
  void buildThumbs();
}

export async function buildThumbs(): Promise<void> {
  el.thumbs.replaceChildren();
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
    await player.seek(sourceOf((i / COUNT) * keptLengthNow()));
    frames[i].tc.getContext('2d')?.drawImage(el.rv, 0, 0, 80, 45);
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function pct(kept: number, seconds: number): number {
  return kept > 0 ? Math.max(0, Math.min(100, (seconds / kept) * 100)) : 0;
}

// A handle position (0..1000 of the timeline) as a fraction of the recording:
// the clip's own map is what turns kept time into recording time.
function handleFraction(units: number): number {
  return app.clip.timeline().sourceFraction((units / Trim.SLIDER_MAX) * keptLengthNow());
}
