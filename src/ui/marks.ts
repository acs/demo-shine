// Timeline marks and cuts.
//
// Clicking the timeline drops a mark; a second click bounds the region between
// the two marks — the region to be trimmed away. Clicking inside that region
// removes it, and clicking a removed region puts it back.
//
// Either kind of bar can then be dragged: a mark slides along the timeline, a
// removed region slides whole or resizes from near an edge. While a bar is being
// dragged the clip plays from the dragged position, so its sound and picture are
// heard as it moves.
//
// This runs alongside the IN/OUT handles, which are untouched: those pick what
// to keep, the cuts pick what to drop. Nothing is re-encoded away — cuts are
// skipped on playback (playback.ts) and on export (exporter.ts).

import { app } from '../state.js';
import { el } from './dom.js';
import { MIN_TRIM_GAP, addSpan, spanAt, spanBetween, type Span } from '../domain/timeline.js';
import { updateSizeUI } from './timeline-ui.js';
import { playFrom, setScrubbing } from './playback.js';

const MIN_REGION = MIN_TRIM_GAP / 1000;   // slider units -> fraction of the clip

const DRAG_MIN   = 3;     // px of travel before a press counts as a drag
const EDGE_GRIP  = 7;     // px near a region's edge that resizes instead of moves
const SEEK_EVERY = 70;    // ms between seeks while dragging

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

// Where on the clip a given screen x sits, 0..1.
function fractionAt(clientX: number): number {
  const rect = el.thumbs.getBoundingClientRect();
  if (rect.width <= 0) return 0;
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
}

export function initTimelineMarks(): void {
  el.timeline.addEventListener('click', evt => {
    if (swallowClick) { swallowClick = false; return; }   // that press was a drag
    if (app.phase !== 'review' || el.rv.readyState < 2) return;
    const target = evt.target as HTMLElement | null;
    if (target?.closest('.tl-header')) return;          // labels + transport button
    if (target && (target.tagName === 'INPUT' || target.tagName === 'BUTTON')) return;

    const rect = el.thumbs.getBoundingClientRect();
    if (rect.width <= 0) return;
    // A click on the last couple of pixels means the OUT point.
    const atEnd = evt.clientX - rect.left >= rect.width - 2;
    const f = atEnd ? 1 : fractionAt(evt.clientX);
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

  el.tlMarks.addEventListener('pointerdown', onBarDown);
  window.addEventListener('pointermove', onBarMove);
  window.addEventListener('pointerup', onBarUp);
  window.addEventListener('pointercancel', onBarUp);
}

// ── Dragging a bar ───────────────────────────────────────────────────────────

type Grab = 'mark' | 'move' | 'left' | 'right';

let grab: Grab | null = null;
let grabIndex = 0;
let grabOffset = 0;      // where in a moved region the pointer took hold
let grabFrom = 0;        // clientX at the press
let grabMoved = false;
let swallowClick = false;
let lastSeek = 0;

function onBarDown(evt: PointerEvent): void {
  swallowClick = false;
  if (app.phase !== 'review' || el.rv.readyState < 2) return;
  const bar = (evt.target as HTMLElement | null)?.closest<HTMLElement>('.tl-mark, .tl-cut');
  if (!bar) return;

  const index = Number(bar.dataset.i);
  const rect = bar.getBoundingClientRect();
  const isMark = bar.classList.contains('tl-mark');
  if (isMark) {
    grab = 'mark';
  } else if (evt.clientX - rect.left <= EDGE_GRIP) {
    grab = 'left';
  } else if (rect.right - evt.clientX <= EDGE_GRIP) {
    grab = 'right';
  } else {
    grab = 'move';
  }
  grabIndex = index;
  grabOffset = grab === 'move' ? fractionAt(evt.clientX) - app.cuts[index].s : 0;
  grabFrom = evt.clientX;
  grabMoved = false;
  lastSeek = 0;
  el.timeline.classList.add('dragging');
}

function onBarMove(evt: PointerEvent): void {
  if (!grab) return;
  if (!grabMoved) {
    if (Math.abs(evt.clientX - grabFrom) < DRAG_MIN) return;
    grabMoved = true;
    setScrubbing(true);        // a removed region plays while it is positioned
  }
  const f = fractionAt(evt.clientX);
  applyGrab(f);
  refresh();
  // Play where the bar now is, so its sound and picture come with it.
  const now = Date.now();
  if (now - lastSeek >= SEEK_EVERY) { lastSeek = now; playFrom(f * app.duration); }
}

function onBarUp(): void {
  if (!grab) return;
  swallowClick = grabMoved;    // the click that follows a drag must not re-trim
  grab = null;
  el.timeline.classList.remove('dragging');
  setScrubbing(false);
}

function applyGrab(f: number): void {
  if (grab === 'mark') {
    app.marks[grabIndex] = f;
    return;
  }
  const c = app.cuts[grabIndex];
  if (!c) return;
  if (grab === 'move') {
    const len = c.e - c.s;
    const s = Math.max(0, Math.min(f - grabOffset, 1 - len));
    app.cuts[grabIndex] = { s, e: s + len };
  } else if (grab === 'left') {
    app.cuts[grabIndex] = { s: Math.max(0, Math.min(f, c.e - MIN_REGION)), e: c.e };
  } else {
    app.cuts[grabIndex] = { s: c.s, e: Math.min(1, Math.max(f, c.s + MIN_REGION)) };
  }
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

  app.cuts.forEach((c, i) => {
    html += `<div class="tl-cut" data-i="${i}" style="left:${pct(c.s)};width:${pct(c.e - c.s)}"`
          + ` title="Removed ${stamp(c.s)}–${stamp(c.e)} — drag to move, click to put it back"></div>`;
  });

  const region = pendingRegion();
  if (region) {
    html += `<div class="tl-sel" style="left:${pct(region.s)};width:${pct(region.e - region.s)}">`
          + `<em>TRIM ${stamp(region.s)}–${stamp(region.e)}</em></div>`;
  }

  app.marks.forEach((m, i) => {
    html += `<div class="tl-mark" data-i="${i}" style="left:${pct(m)}" title="Mark ${stamp(m)} — drag to move"></div>`;
  });

  host.innerHTML = html;
  el.tCut.textContent = region
    ? `· removing ${stamp(region.s)}–${stamp(region.e)}`
    : app.marks.length === 1 ? '· click again to close the region' : '';
}
