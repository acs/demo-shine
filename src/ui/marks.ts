// Timeline marks, the sections they select, and the trim they approve.
//
// The clip can be trimmed in two independent ways, and this module owns the
// second one:
//
//   * the keep range, dragged with the blue/red IN/OUT handles (timeline-ui.ts);
//   * removed sections, selected with marks and approved here.
//
// The gesture, in full:
//
//   click                     drop a mark (and play from there)
//   click again               bound the section between the two marks
//   ✓ / click inside it       trim it out — the section leaves the timeline
//   ✗                         leave it in; the selection is dropped
//   drag a mark / the section move what is selected, and the clip plays there
//
// An approved trim is taken out of the timeline and what is left closes up, so
// the timeline shows what the export will hold and no discarded hatching is left
// lying about. That mapping is in clip.ts (keptOf/sourceOf); everything here
// works in the recording's own time and converts on the way to the screen. The
// recording itself is never re-encoded — playback and the export simply skip the
// removed stretches — which is what makes one "Undo" enough to put a section
// back.

import { app } from '../state.js';
import { el } from './dom.js';
import {
  MIN_TRIM_GAP, Span, addSpan, moveSpan, resizeSpan, spanBetween,
} from '../domain/timeline.js';
import { rebuildTimeline, updateSizeUI } from './timeline-ui.js';
import { clipTime, keptLengthNow, keptOf, sourceOf } from './clip.js';
import { playFrom, seekPlayback, setScrubbing } from './playback.js';

const MIN_REGION = MIN_TRIM_GAP / 1000;   // slider units -> fraction of the clip

const DRAG_MIN   = 3;     // px of travel before a press counts as a drag
const EDGE_GRIP  = 7;     // px near a section's edge that resizes instead of moves
const SEEK_EVERY = 70;    // ms between seeks while dragging

let lastTrim: { marks: number[]; cuts: Span[]; removed: number } | null = null;

// ── Public API ───────────────────────────────────────────────────────────────

export function resetMarks(): void {
  app.marks = [];
  app.cuts = [];
  lastTrim = null;
  renderMarks();
  updateSizeUI();          // clearing the cuts restores the estimate
}

// A new part was added to the end, so the clip is longer. Marks and cuts are
// held as fractions of it: re-base them so they stay over the same moments of
// the recording, and the added recording is not covered by an old cut.
export function rescaleMarks(wasTotal: number, nowTotal: number): void {
  lastTrim = null;         // the recording it referred to has moved under it
  if (!(wasTotal > 0) || !(nowTotal > wasTotal)) { renderMarks(); return; }
  const k = wasTotal / nowTotal;
  app.marks = app.marks.map(m => m * k);
  app.cuts  = app.cuts.map(c => Span.of(c.s * k, c.e * k));
  renderMarks();
  updateSizeUI();
}

export function initTimelineMarks(): void {
  el.timeline.addEventListener('click', onTimelineClick);
  el.tlMarks.addEventListener('click', onActionClick);     // the check and the cross
  el.trimUndo.addEventListener('click', undoTrim);
  el.tlMarks.addEventListener('pointerdown', onBarDown);
  window.addEventListener('pointermove', onBarMove);
  window.addEventListener('pointerup', onBarUp);
  window.addEventListener('pointercancel', onBarUp);
}

// Paint the marks and the selected section over the timeline, and the actions
// for the section in the header.
export function renderMarks(): void {
  const d = app.duration;
  const host = el.tlMarks;
  const region = pendingRegion();

  if (app.phase !== 'review' || !(d > 0)) {
    host.replaceChildren();
    el.tTrim.classList.remove('on');
    return;
  }

  // `at` and `stamp` take seconds of the recording; the selection and the marks
  // are held as fractions of it.
  const at = (seconds: number) => ((keptOf(seconds) / Math.max(0.001, keptLengthNow())) * 100).toFixed(3) + '%';
  const stamp = (seconds: number) => keptOf(seconds).toFixed(2) + 's';
  let html = '';

  if (region) {
    html += `<div class="tl-sel" style="left:${at(region.s * d)};width:${pctWidth(region)}">`
          + `<em>TRIM ${stamp(region.s * d)}–${stamp(region.e * d)}</em></div>`;
    // the two answers sit on the section itself, clamped so they stay reachable
    const centre = (keptOf(region.s * d) + keptOf(region.e * d)) / 2 / Math.max(0.001, keptLengthNow()) * 100;
    html += `<span class="tl-acts" style="left:${Math.max(7, Math.min(93, centre)).toFixed(2)}%">`
          + `<button class="tl-act ok" data-act="trim" title="Trim this section out" aria-label="Trim this section out">`
          + `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5.5 5.5L20 6.5"/></svg></button>`
          + `<button class="tl-act no" data-act="keep" title="Leave this section in" aria-label="Leave this section in">`
          + `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`
          + `</span>`;
  }
  app.marks.forEach((m, i) => {
    html += `<div class="tl-mark" data-i="${i}" style="left:${at(m * d)}" title="Mark ${stamp(m * d)} — drag to move"></div>`;
  });
  host.innerHTML = html;

  // the actions: approve or leave the selection, or take the last trim back
  if (region) {
    el.tCut.textContent = `TRIM ${stamp(region.s * d)}–${stamp(region.e * d)}`;
    el.trimUndo.style.display = 'none';
    el.tTrim.classList.add('on');
  } else if (lastTrim) {
    el.tCut.textContent = `TRIMMED ${lastTrim.removed.toFixed(2)}s`;
    el.trimUndo.style.display = '';
    el.tTrim.classList.add('on');
  } else {
    el.tCut.textContent = app.marks.length === 1 ? 'mark set — click again to close the section' : '';
    el.trimUndo.style.display = 'none';
    el.tTrim.classList.toggle('on', app.marks.length === 1);
  }
}

function pctWidth(region: Span): string {
  const kept = Math.max(0.001, keptLengthNow());
  return (((keptOf(region.e * app.duration) - keptOf(region.s * app.duration)) / kept) * 100).toFixed(3) + '%';
}

// The check and the cross are drawn with the section, so they are read here
// rather than bound to an element that is replaced on every repaint.
function onActionClick(evt: MouseEvent): void {
  const act = (evt.target as HTMLElement | null)?.closest<HTMLElement>('.tl-act');
  if (!act) return;
  evt.stopPropagation();
  if (act.dataset.act === 'trim') approveTrim();
  else                            dismissSelection();
}

// ── Approving, dismissing, undoing ───────────────────────────────────────────

// The green check: take the section out. The timeline closes up over it, and the
// playhead lands where the section was.
function approveTrim(): void {
  if (!canEdit()) return;
  const region = pendingRegion();
  if (!region) return;
  const wasKept = keptLengthNow();
  lastTrim = { marks: app.marks, cuts: app.cuts, removed: 0 };
  app.cuts = addSpan(app.cuts, region);
  app.marks = [];
  lastTrim.removed = wasKept - keptLengthNow();   // how much left the timeline
  afterEdits(region.s * app.duration);            // a time in the recording
}

// The red cross: leave the section in and drop the selection.
function dismissSelection(): void {
  app.marks = [];
  renderMarks();
  updateSizeUI();
}

// Put the last approved trim back.
function undoTrim(): void {
  if (!lastTrim) return;
  app.marks = lastTrim.marks;
  app.cuts = lastTrim.cuts;
  lastTrim = null;
  afterEdits(clipTime());
}

function afterEdits(at: number): void {
  renderMarks();
  rebuildTimeline();            // the timeline is a different length now
  void seekPlayback(at);        // the playhead follows what is left
}

// ── Clicking the timeline ────────────────────────────────────────────────────

function onTimelineClick(evt: MouseEvent): void {
  if (swallowNextClick) { swallowNextClick = false; return; }   // that press was a drag
  if (!canEdit()) return;

  const target = evt.target as HTMLElement | null;
  if (target?.closest('.tl-header')) return;                    // labels + actions
  if (target && (target.tagName === 'INPUT' || target.tagName === 'BUTTON')) return;

  const width = track().width;
  if (width <= 0) return;
  // A click on the last couple of pixels means the end of the clip.
  const atEnd = evt.clientX - track().left >= width - 2;
  const f = atEnd ? 1 : fractionAt(evt.clientX);
  const time = f * app.duration;

  // Inside the selected section: that is the confirmation — trim it out.
  const region = pendingRegion();
  if (region && f >= region.s && f <= region.e) { approveTrim(); playFrom(time); return; }

  // Otherwise drop a mark. A click outside the section starts a new pair.
  app.marks = app.marks.length >= 2 ? [f] : [...app.marks, f].sort((a, b) => a - b);
  renderMarks();
  playFrom(time);
}

// ── Dragging a bar ───────────────────────────────────────────────────────────

type GrabKind = 'mark' | 'move' | 'left' | 'right';

interface Press {
  kind: GrabKind;
  index: number;
  offset: number;    // where in the section the pointer took hold
  fromX: number;     // clientX at the press
  moved: boolean;    // has it travelled far enough to count as a drag?
  lastSeek: number;  // when the clip was last moved to follow the bar
}

let press: Press | null = null;
let swallowNextClick = false;   // the click that follows a drag must not re-trim

function onBarDown(evt: PointerEvent): void {
  swallowNextClick = false;
  if (!canEdit()) return;
  const bar = (evt.target as HTMLElement | null)?.closest<HTMLElement>('.tl-mark, .tl-sel');
  if (!bar) return;

  const rect = bar.getBoundingClientRect();
  const kind: GrabKind = bar.classList.contains('tl-mark') ? 'mark'
    : evt.clientX - rect.left <= EDGE_GRIP ? 'left'
    : rect.right - evt.clientX <= EDGE_GRIP ? 'right'
    : 'move';

  press = {
    kind,
    index: Number(bar.dataset.i),
    offset: kind === 'move' ? fractionAt(evt.clientX) - (pendingRegion()?.s ?? 0) : 0,
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
    setScrubbing(true);      // a section plays while it is being positioned
  }

  const f = fractionAt(evt.clientX);
  dragTo(f);
  renderMarks();
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
  // the section between the marks, moved or resized by an edge
  const region = pendingRegion();
  if (!region) return;
  const f0 = region.s, f1 = region.e;        // already fractions of the recording
  if (p.kind === 'move')       { const m = moveSpan({ s: f0, e: f1 }, f - p.offset); app.marks = [m.s, m.e]; }
  else if (p.kind === 'left')  { const m = resizeSpan({ s: f0, e: f1 }, 's', f, MIN_REGION); app.marks = [m.s, m.e]; }
  else                         { const m = resizeSpan({ s: f0, e: f1 }, 'e', f, MIN_REGION); app.marks = [m.s, m.e]; }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function canEdit(): boolean {
  return app.phase === 'review' && el.rv.readyState >= 1;   // metadata is enough; a seek in flight must not drop a click
}

// The track is what the marks are laid out against; a click x maps onto it.
function track(): DOMRect {
  return el.thumbs.getBoundingClientRect();
}

// Where on the recording a given screen x sits, 0..1. The timeline is in
// timeline time, so this is where the mapping comes back the other way.
function fractionAt(clientX: number): number {
  const t = track();
  if (t.width <= 0 || !(app.duration > 0)) return 0;
  const kept = Math.max(0, Math.min(1, (clientX - t.left) / t.width));
  return Math.max(0, Math.min(1, sourceOf(kept * keptLengthNow()) / app.duration));
}

// The span the two pending marks bound, or null while there is not a pair yet.
function pendingRegion(): Span | null {
  return app.marks.length === 2 ? spanBetween(app.marks[0], app.marks[1], MIN_REGION) : null;
}
