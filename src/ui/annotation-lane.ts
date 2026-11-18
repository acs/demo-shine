// The timeline lane: where the annotations are in time.
//
// An arrow is invisible outside its stretch, so the timeline has to show where it
// is — otherwise a person who forgot where they put one has to scrub the whole clip
// to find it. A bar per annotation, laid out in timeline (kept) time exactly as the
// marks are, so a cut closes up over it too. Clicking a bar picks that arrow and
// brings the playhead to it; dragging a bar moves the stretch it is shown over; the
// picked one carries a delete.
//
// It is a view of the clip and nothing else: the clip saying what changed is the
// whole of the coupling, and the picture's selection is followed through
// `onSelectionChange`.

import { app } from '../state.js';
import { el } from './dom.js';
import { Span } from '../domain/clip/Span.js';
import { keptLengthNow, keptOf } from './clip.js';
import { playback } from './playback.js';
import { edit, onSelectionChange } from './annotation-edit.js';

const DRAG_MIN = 3;      // px of travel before a press counts as a drag

const ARROW_ICON = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19L19 5"/><path d="M12 5h7v7"/></svg>';

// A bar dragged along the lane: which annotation, and where in it the pointer took
// hold. It is the interaction's own state, so it lives on an object with a lifetime.
class LaneDrag {
  private id: string | null = null;
  private offset = 0;      // where in the span the pointer took hold
  private fromX = 0;
  private moved = false;

  down(e: PointerEvent, id: string): void {
    const annotation = app.clip.annotations.byId(id);
    this.id = id;
    this.fromX = e.clientX;
    this.moved = false;
    this.offset = annotation ? fractionAt(e.clientX) - annotation.span.s : 0;
    el.timeline.classList.add('dragging');
  }

  move(e: PointerEvent): void {
    if (!this.id) return;
    if (!this.moved && Math.abs(e.clientX - this.fromX) < DRAG_MIN) return;
    this.moved = true;
    const annotation = app.clip.annotations.byId(this.id);
    if (!annotation) return;
    const total = app.clip.total();
    if (!(total > 0)) return;
    const start = Math.max(0, Math.min(1 - annotation.span.length, fractionAt(e.clientX) - this.offset));
    // The clip announces the change; the redraw is the listener's, not this.
    app.clip.changeAnnotation(annotation.id, annotation.withSpan(Span.of(start, start + annotation.span.length)));
  }

  up(): void {
    this.id = null;
    this.moved = false;
    el.timeline.classList.remove('dragging');
  }

  /** Is the click that follows the drag the drag's own, rather than a new pick? */
  takesTheClick(): boolean {
    const was = this.moved;
    this.moved = false;
    return was;
  }
}

const drag = new LaneDrag();

export function initAnnotationLane(): void {
  el.tlAnnots.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', e => drag.move(e));
  window.addEventListener('pointerup', () => drag.up());
  window.addEventListener('pointercancel', () => drag.up());
  el.tlAnnots.addEventListener('click', onClick);

  // The clip says what changed; the lane follows. And the picture's selection is
  // followed too, so the bar and the arrow are never picked apart.
  app.clip.onChange(event => {
    if (event.type !== 'take-added') renderLane();
  });
  onSelectionChange(renderLane);
  renderLane();
}

function onDown(e: PointerEvent): void {
  const bar = (e.target as HTMLElement | null)?.closest<HTMLElement>('.tl-annot');
  if (!bar) return;
  e.stopPropagation();
  const id = bar.dataset.id ?? '';
  if ((e.target as HTMLElement | null)?.closest('.tl-annot-del')) { app.clip.removeAnnotation(id); return; }
  pick(id);
  drag.down(e, id);
  e.preventDefault();
}

function onClick(e: MouseEvent): void {
  if (drag.takesTheClick()) return;
  const bar = (e.target as HTMLElement | null)?.closest<HTMLElement>('.tl-annot');
  if (bar) pick(bar.dataset.id ?? '');
}

// Picking a bar picks the arrow on the picture and brings the playhead to it.
function pick(id: string): void {
  const annotation = app.clip.annotations.byId(id);
  if (!annotation) return;
  edit.pick(id);
  playback.hold(annotation.span.s * app.clip.total());
}

/** Draw a bar per annotation, in kept time, with the picked one marked. */
export function renderLane(): void {
  const host = el.tlAnnots;
  if (app.phase !== 'review' || !(app.clip.total() > 0)) {
    host.replaceChildren();
    return;
  }
  const total = app.clip.total();
  const kept = Math.max(0.001, keptLengthNow());
  const selected = edit.selectedId;
  let html = '';
  for (const annotation of app.clip.annotations.all) {
    const s = keptOf(annotation.span.s * total), e = keptOf(annotation.span.e * total);
    if (e - s < 0.001) continue;                 // entirely cut away: nothing to show
    const left = (s / kept) * 100, width = ((e - s) / kept) * 100;
    const on = annotation.id === selected;
    html += `<div class="tl-annot${on ? ' on' : ''}" data-id="${annotation.id}"`
          + ` style="left:${left.toFixed(3)}%;width:${width.toFixed(3)}%"`
          + ` title="Arrow — click to go to it, drag to move it">${ARROW_ICON}`
          + (on ? `<button class="tl-annot-del" title="Delete this arrow" aria-label="Delete this arrow">×</button>` : '')
          + `</div>`;
  }
  host.innerHTML = html;
}

// Where on the recording a screen x sits, 0..1 — the same mapping the marks use.
function fractionAt(clientX: number): number {
  const track = el.thumbs.getBoundingClientRect();
  if (track.width <= 0 || !(app.clip.total() > 0)) return 0;
  const kept = Math.max(0, Math.min(1, (clientX - track.left) / track.width));
  return Math.max(0, Math.min(1, app.clip.timeline().sourceOf(kept * keptLengthNow()) / app.clip.total()));
}
