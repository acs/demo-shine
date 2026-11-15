// Timeline marks, the sections they select, and the trim they approve.
//
// The clip can be trimmed in two independent ways, and this module owns the
// second one:
//
//   * the keep range, dragged with the blue/red IN/OUT handles (timeline-ui.ts);
//   * the cuts: a section selected with two marks and approved here, which leaves
//
// The gesture, in full:
//
//   click                     drop a mark (and play from there)
//   click again               bound the section between the two marks
//   ✓ / click inside it       approve it — the section becomes a cut and leaves
//   ✗                         leave it in; the selection is dropped
//   drag a mark / the section  move what is selected; the clip plays under it
//
// An approved trim is taken out of the timeline and what is left closes up, so
// the timeline shows what the export will hold and no discarded hatching is left
// lying about. That mapping is in clip.ts (keptOf/sourceOf); everything here
// works in the recording's own time and converts on the way to the screen. The
// recording itself is never re-encoded — playback and the export simply skip the
// cut stretches — which is what makes one "Undo" enough to put a cut back.

import { app } from '../state.js';
import type { ClipEvent } from '../domain/clip/Clip.js';
import { el } from './dom.js';
import { Span } from '../domain/clip/Span.js';
import { Trim } from '../domain/clip/Trim.js';
import { updateSizeUI } from './timeline-ui.js';
import { keptLengthNow, keptOf, player, sourceOf } from './clip.js';
import { playback } from './playback.js';

const MIN_SECTION = Trim.MIN_GAP;   // a hundredth of the clip: the shortest section worth trimming

const DRAG_MIN   = 3;     // px of travel before a press counts as a drag
const EDGE_GRIP  = 7;     // px near a section's edge that resizes instead of moves
const SEEK_EVERY = 70;    // ms between seeks while dragging

// ── Public API ───────────────────────────────────────────────────────────────

// The marks are the view's, but they sit over the clip, so they move when it does.
// The clip says what happened; nothing here has to be remembered by the caller.
function followTheClip(event: ClipEvent): void {
  switch (event.type) {
    case 'take-added': {
      // Fractions of the clip: a new take makes it longer, so the marks move with
      // the moments they were placed over. The first take begins a new clip, which
      // has nothing selected yet.
      if (event.index === 0) app.marks = [];
      else if (event.previousTotal > 0) {
        const k = event.previousTotal / app.clip.total();
        app.marks = app.marks.map(m => m * k);
      }
      break;
    }
    case 'trim-approved':
      app.marks = [];                              // the selection was spent on it
      break;
    case 'trim-undone':
      app.marks = [event.cut.s, event.cut.e];   // the cut, selected again
      break;
    case 'cleared':
      app.marks = [];
      break;
    case 'keep-range':
      return;                    // the handles moved; the marks did not
  }
  renderMarks();
}

export function initTimelineMarks(): void {
  app.clip.onChange(followTheClip);
  el.timeline.addEventListener('click', onTimelineClick);
  el.tlMarks.addEventListener('click', onActionClick);     // the check and the cross
  el.trimUndo.addEventListener('click', undoTrim);
  el.tlMarks.addEventListener('pointerdown', evt => drag.down(evt));
  window.addEventListener('pointermove', evt => drag.move(evt));
  window.addEventListener('pointerup', () => drag.up());
  window.addEventListener('pointercancel', () => drag.up());
}

// Paint the marks and the selected section over the timeline, and the actions
// for the section in the header.
export function renderMarks(): void {
  const d = app.clip.total();
  const host = el.tlMarks;
  const section = pendingSection();

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

  if (section) {
    html += `<div class="tl-sel" style="left:${at(section.s * d)};width:${pctWidth(section)}">`
          + `<em>TRIM ${stamp(section.s * d)}–${stamp(section.e * d)}</em></div>`;
    // the two answers sit on the section itself, clamped so they stay reachable
    const centre = (keptOf(section.s * d) + keptOf(section.e * d)) / 2 / Math.max(0.001, keptLengthNow()) * 100;
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
  if (section) {
    el.tCut.textContent = `TRIM ${stamp(section.s * d)}–${stamp(section.e * d)}`;
    el.trimUndo.style.display = 'none';
    el.tTrim.classList.add('on');
  } else if (app.clip.canUndo()) {
    el.tCut.textContent = `TRIMMED ${app.clip.lastRemoved().toFixed(2)}s`;
    el.trimUndo.style.display = '';
    el.tTrim.classList.add('on');
  } else {
    el.tCut.textContent = app.marks.length === 1 ? 'mark set — click again to close the section' : '';
    el.trimUndo.style.display = 'none';
    el.tTrim.classList.toggle('on', app.marks.length === 1);
  }
}

function pctWidth(section: Span): string {
  const kept = Math.max(0.001, keptLengthNow());
  return (((keptOf(section.e * app.clip.total()) - keptOf(section.s * app.clip.total())) / kept) * 100).toFixed(3) + '%';
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
  const section = pendingSection();
  if (!section) return;
  app.clip.approve(section);                       // it leaves the timeline, and closes up
  afterEdits(section.s * app.clip.total());        // a time in the recording
}

// The red cross: leave the section in and drop the selection.
function dismissSelection(): void {
  app.marks = [];
  renderMarks();
  updateSizeUI();
}

// Put the last approved trim back.
function undoTrim(): void {
  if (!app.clip.undo()) return;                   // the clip puts the section back
  afterEdits(player.time());
}

// The marks and the timeline redraw because the clip told them to; all that is
// left to do here is follow the playhead.
function afterEdits(at: number): void {
  void playback.seek(at);
}

// ── Clicking the timeline ────────────────────────────────────────────────────

function onTimelineClick(evt: MouseEvent): void {
  if (drag.takesTheClick()) return;                             // that press was a drag
  if (!canEdit()) return;

  const target = evt.target as HTMLElement | null;
  if (target?.closest('.tl-header')) return;                    // labels + actions
  if (target && (target.tagName === 'INPUT' || target.tagName === 'BUTTON')) return;

  const width = track().width;
  if (width <= 0) return;
  // A click on the last couple of pixels means the end of the clip.
  const atEnd = evt.clientX - track().left >= width - 2;
  const f = atEnd ? 1 : fractionAt(evt.clientX);
  const time = f * app.clip.total();

  // Inside the selected section: that is the confirmation — trim it out.
  const section = pendingSection();
  if (section && f >= section.s && f <= section.e) { approveTrim(); playback.playFrom(time); return; }

  // Otherwise drop a mark. A click outside the section starts a new pair.
  app.marks = app.marks.length >= 2 ? [f] : [...app.marks, f].sort((a, b) => a - b);
  renderMarks();
  playback.playFrom(time);
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

// The gesture in flight: which bar the pointer took hold of, and whether the click
// that follows it belongs to the drag rather than being a new mark. It is the
// interaction's own state and nothing else can see it, so it lives on an object
// with a lifetime — and the session ends that lifetime, because a drag must not
// outlive the clip it was trimming.
class MarkDrag {
  private press: Press | null = null;
  private swallow = false;

  /** Is a bar being held? */
  get active(): boolean {
    return this.press !== null;
  }

  /** The pointer went down on a bar: this is the gesture until it comes up. */
  down(evt: PointerEvent): void {
    this.swallow = false;
    if (!canEdit()) return;
    const bar = (evt.target as HTMLElement | null)?.closest<HTMLElement>('.tl-mark, .tl-sel');
    if (!bar) return;

    const rect = bar.getBoundingClientRect();
    const kind: GrabKind = bar.classList.contains('tl-mark') ? 'mark'
      : evt.clientX - rect.left <= EDGE_GRIP ? 'left'
      : rect.right - evt.clientX <= EDGE_GRIP ? 'right'
      : 'move';

    this.press = {
      kind,
      index: Number(bar.dataset.i),
      offset: kind === 'move' ? fractionAt(evt.clientX) - (pendingSection()?.s ?? 0) : 0,
      fromX: evt.clientX,
      moved: false,
      lastSeek: 0,
    };
    el.timeline.classList.add('dragging');
  }

  /** The pointer moved: the bar follows it, and the clip plays under it. */
  move(evt: PointerEvent): void {
    const press = this.press;
    if (!press) return;
    if (!press.moved) {
      if (Math.abs(evt.clientX - press.fromX) < DRAG_MIN) return;
      press.moved = true;
      playback.setScrubbing(true);      // a section plays while it is being positioned
    }

    const f = fractionAt(evt.clientX);
    this.dragTo(f);
    renderMarks();
    // Play where the bar now is, so its sound and picture come with it.
    const now = Date.now();
    if (now - press.lastSeek >= SEEK_EVERY) { press.lastSeek = now; playback.playFrom(f * app.clip.total()); }
  }

  /** The pointer came up. */
  up(): void {
    const press = this.press;
    if (!press) return;
    this.cancel();
    this.swallow = press.moved;    // the click that follows a drag must not re-trim
  }

  /** Is the click that follows the drag the drag's own, rather than a new mark? */
  takesTheClick(): boolean {
    const was = this.swallow;
    this.swallow = false;
    return was;
  }

  /** The session is over: nothing is being held, and the next click is a click. */
  cancel(): void {
    this.press = null;
    this.swallow = false;
    el.timeline.classList.remove('dragging');
    playback.setScrubbing(false);
  }

  private dragTo(f: number): void {
    const p = this.press;
    if (!p) return;
    if (p.kind === 'mark') {
      app.marks[p.index] = f;
      return;
    }
    // the section between the marks, moved or resized by an edge
    const section = pendingSection();
    if (!section) return;
    const f0 = section.s, f1 = section.e;        // already fractions of the recording
    const span = Span.of(f0, f1);
    const moved = p.kind === 'move' ? span.movedTo(f - p.offset)
                : p.kind === 'left' ? span.resized('s', f, MIN_SECTION)
                : span.resized('e', f, MIN_SECTION);
    app.marks = [moved.s, moved.e];
  }
}

export const drag = new MarkDrag();

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
  if (t.width <= 0 || !(app.clip.total() > 0)) return 0;
  const kept = Math.max(0, Math.min(1, (clientX - t.left) / t.width));
  return Math.max(0, Math.min(1, sourceOf(kept * keptLengthNow()) / app.clip.total()));
}

// The span the two pending marks bound, or null while there is not a pair yet.
function pendingSection(): Span | null {
  return app.marks.length === 2 ? Span.between(app.marks[0], app.marks[1], MIN_SECTION) : null;
}
