// Timeline marks and cuts.
//
// Clicking the timeline drops a mark; a second click bounds the region between
// the two marks — the region to be trimmed away. Clicking inside that region
// removes it, and clicking a removed region puts it back.
//
// This runs alongside the IN/OUT handles, which are untouched: those pick what
// to keep, the cuts pick what to drop. Nothing is re-encoded away — cuts are
// skipped on playback (playback.ts) and on export (exporter.ts).

import { app } from '../state.js';
import { el } from './dom.js';
import { MIN_TRIM_GAP, addSpan, spanAt, spanBetween, type Span } from '../domain/timeline.js';
import { updateSizeUI } from './timeline-ui.js';
import { playFrom } from './playback.js';

const MIN_REGION = MIN_TRIM_GAP / 1000;   // slider units -> fraction of the clip

export function resetMarks(): void {
  app.marks = [];
  app.cuts = [];
  renderMarks();
  updateSizeUI();          // clearing the cuts restores the estimate
}

// Cuts in seconds, for the playback loop and the exporter.
export function cutSeconds(): Span[] {
  const d = app.duration;
  return app.cuts.map(c => ({ s: c.s * d, e: c.e * d }));
}

// The span the two pending marks bound, or null while there is not a pair yet.
function pendingRegion(): Span | null {
  return app.marks.length === 2 ? spanBetween(app.marks[0], app.marks[1], MIN_REGION) : null;
}

export function initTimelineMarks(): void {
  el.timeline.addEventListener('click', evt => {
    if (app.phase !== 'review' || el.rv.readyState < 2) return;
    const target = evt.target as HTMLElement | null;
    if (target?.closest('.tl-header')) return;          // labels + transport button
    if (target && (target.tagName === 'INPUT' || target.tagName === 'BUTTON')) return;

    const rect = el.thumbs.getBoundingClientRect();
    if (rect.width <= 0) return;
    // A click on the last couple of pixels means the OUT point.
    const atEnd = evt.clientX - rect.left >= rect.width - 2;
    const f = atEnd ? 1 : Math.max(0, Math.min(1, (evt.clientX - rect.left) / rect.width));
    const time = f * app.duration;

    // Inside an already-removed region: put it back.
    const done = spanAt(app.cuts, f);
    if (done >= 0) {
      app.cuts = app.cuts.filter((_, i) => i !== done);
      refresh();
      playFrom(time);
      return;
    }

    // Inside the pending region: that is the confirmation — trim it.
    const region = pendingRegion();
    if (region && f >= region.s && f <= region.e) {
      app.cuts = addSpan(app.cuts, region);
      app.marks = [];
      refresh();
      playFrom(time);
      return;
    }

    // Otherwise drop a mark. A click outside the pending region starts a new pair.
    app.marks = app.marks.length >= 2 ? [f] : [...app.marks, f].sort((a, b) => a - b);
    renderMarks();
    playFrom(time);
  });
}

function refresh(): void {
  renderMarks();
  updateSizeUI();
}

// Draw the marks and the cut regions over the timeline track.
export function renderMarks(): void {
  const d = app.duration;
  const host = el.tlMarks;
  if (app.phase !== 'review' || !(d > 0)) { host.innerHTML = ''; el.tCut.textContent = ''; return; }

  const pct = (v: number) => (v * 100).toFixed(3) + '%';
  const stamp = (v: number) => (v * d).toFixed(2) + 's';
  let html = '';

  for (const c of app.cuts) {
    html += `<div class="tl-cut" style="left:${pct(c.s)};width:${pct(c.e - c.s)}" title="Removed ${stamp(c.s)}–${stamp(c.e)} — click to put it back"></div>`;
  }

  const region = pendingRegion();
  if (region) {
    html += `<div class="tl-sel" style="left:${pct(region.s)};width:${pct(region.e - region.s)}">`
          + `<em>TRIM ${stamp(region.s)}–${stamp(region.e)}</em></div>`;
  }

  for (const m of app.marks) {
    html += `<div class="tl-mark" style="left:${pct(m)}" title="Mark ${stamp(m)}"></div>`;
  }

  host.innerHTML = html;
  el.tCut.textContent = region
    ? `· removing ${stamp(region.s)}–${stamp(region.e)}`
    : app.marks.length === 1 ? '· click again to close the region' : '';
}
