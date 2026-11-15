// Timeline marks and cuts — the controller for the trim-by-region gesture.
//
// The clip can be trimmed in two independent ways, and this module owns the
// second one:
//
//   * the keep range, dragged with the blue/red IN/OUT handles (timeline-ui.ts);
//   * removed regions ("cuts"), bounded by two marks on the timeline (here).
//
// The gesture, in full:
//
//   click                     drop a mark (and play from there)
//   click again               bound the region between the two marks
//   click inside that region  remove it — it becomes a cut
//   click a cut               put it back
//   drag a bar                move a mark, or move/resize a cut; the clip plays
//                             from wherever the bar is while it is dragged
//
// All the arithmetic lives in domain/timeline.ts (pure and unit-tested); this
// module only holds state, wires pointer events and paints the overlay. Cuts are
// skipped on playback (playback.ts) and on export (exporter.ts) — nothing is
// re-encoded away, which is what keeps a cut cheap and reversible.

import { app } from '../state.js';
import { el } from './dom.js';
import {
  MIN_TRIM_GAP, addSpan, moveSpan, resizeSpan, spanAt, spanBetween, type Span,
} from '../domain/timeline.js';
import { updateSizeUI } from './timeline-ui.js';
import { playFrom, setScrubbing } from './playback.js';

const MIN_REGION = MIN_TRIM_GAP / 1000;   // slider units -> fraction of the clip

const DRAG_MIN   = 3;     // px of travel before a press counts as a drag
const EDGE_GRIP  = 7;     // px near a cut's edge that resizes instead of moves
const SEEK_EVERY = 70;    // ms between seeks while dragging

// ── Public API ───────────────────────────────────────────────────────────────

export function resetMarks(): void {
  app.marks = [];
  app.cuts = [];
  renderMarks();
  updateSizeUI();          // clearing the cuts restores the estimate
}

export function initTimelineMarks(): void {
  el.timeline.addEventListener('click', onTimelineClick);
  el.tlMarks.addEventListener('pointerdown', onBarDown);
  window.addEventListener('pointermove', onBarMove);
  window.addEventListener('pointerup', onBarUp);
  window.addEventListener('pointercancel', onBarUp);
}

// Paint the marks and the removed regions over the timeline track.
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

// ── Clicking the timeline ────────────────────────────────────────────────────

function onTimelineClick(evt: MouseEvent): void {
  if (swallowNextClick) { swallowNextClick = false; return; }   // that press was a drag
  if (!canEdit()) return;

  const target = evt.target as HTMLElement | null;
  if (target?.closest('.tl-header')) return;                    // labels + transport button
  if (target && (target.tagName === 'INPUT' || target.tagName === 'BUTTON')) return;

  const width = trackWidth();
  if (width <= 0) return;
  // A click on the last couple of pixels means the OUT point.
  const atEnd = evt.clientX - trackLeft() >= width - 2;
  const f = atEnd ? 1 : fractionAt(evt.clientX);
  const time = f * app.duration;

  // Inside an already-removed region: put it back.
  const removed = spanAt(app.cuts, f);
  if (removed >= 0) {
    app.cuts = app.cuts.filter((_, i) => i !== removed);
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
}

// ── Dragging a bar ───────────────────────────────────────────────────────────

type GrabKind = 'mark' | 'move' | 'left' | 'right';

interface Press {
  kind: GrabKind;
  index: number;
  offset: number;    // where inside a moved cut the pointer took hold
  fromX: number;     // clientX at the press
  moved: boolean;    // has it travelled far enough to count as a drag?
  lastSeek: number;  // when the clip was last moved to follow the bar
}

let press: Press | null = null;
let swallowNextClick = false;   // the click that follows a drag must not re-trim

function onBarDown(evt: PointerEvent): void {
  swallowNextClick = false;
  if (!canEdit()) return;
  const bar = (evt.target as HTMLElement | null)?.closest<HTMLElement>('.tl-mark, .tl-cut');
  if (!bar) return;

  const index = Number(bar.dataset.i);
  const rect  = bar.getBoundingClientRect();
  const kind: GrabKind = bar.classList.contains('tl-mark') ? 'mark'
    : evt.clientX - rect.left <= EDGE_GRIP ? 'left'
    : rect.right - evt.clientX <= EDGE_GRIP ? 'right'
    : 'move';

  press = {
    kind,
    index,
    offset: kind === 'move' ? fractionAt(evt.clientX) - app.cuts[index].s : 0,
    fromX: evt.clientX,
    moved: false,
    lastSeek: 0,
  };
  el.timeline.classList.add('dragging');
}

function onBarMove(evt: PointerEvent): void {
  if (!press) return;
  if (!press.moved) {
    if (Math.abs(evt.clientX - press.fromX) < DRAG_MIN) return;
    press.moved = true;
    setScrubbing(true);      // a cut plays while it is being positioned
  }

  const f = fractionAt(evt.clientX);
  dragTo(f);
  refresh();
  // Play where the bar now is, so its sound and picture come with it.
  const now = Date.now();
  if (now - press.lastSeek >= SEEK_EVERY) { press.lastSeek = now; playFrom(f * app.duration); }
}

function onBarUp(): void {
  if (!press) return;
  swallowNextClick = press.moved;    // the click that follows a drag must not re-trim
  press = null;
  el.timeline.classList.remove('dragging');
  setScrubbing(false);
}

function dragTo(f: number): void {
  const p = press;
  if (!p) return;
  if (p.kind === 'mark') {
    app.marks[p.index] = f;
    return;
  }
  const cut = app.cuts[p.index];
  if (!cut) return;
  if (p.kind === 'move')       app.cuts[p.index] = moveSpan(cut, f - p.offset);
  else if (p.kind === 'left')  app.cuts[p.index] = resizeSpan(cut, 's', f, MIN_REGION);
  else                         app.cuts[p.index] = resizeSpan(cut, 'e', f, MIN_REGION);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function canEdit(): boolean {
  return app.phase === 'review' && el.rv.readyState >= 2;
}

// The track is what the marks are laid out against; a click x maps onto it.
function track(): DOMRect {
  return el.thumbs.getBoundingClientRect();
}

function trackWidth(): number {
  return track().width;
}

function trackLeft(): number {
  return track().left;
}

// Where on the clip a given screen x sits, 0..1.
function fractionAt(clientX: number): number {
  const t = track();
  if (t.width <= 0) return 0;
  return Math.max(0, Math.min(1, (clientX - t.left) / t.width));
}

// The span the two pending marks bound, or null while there is not a pair yet.
function pendingRegion(): Span | null {
  return app.marks.length === 2 ? spanBetween(app.marks[0], app.marks[1], MIN_REGION) : null;
}

function refresh(): void {
  renderMarks();
  updateSizeUI();
}
