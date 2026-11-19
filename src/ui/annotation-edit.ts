// The arrow on the picture: drawing a new one, and picking and dragging one that is
// already there.
//
// The gesture belongs to the interaction and to nothing else, so it lives on an
// object with a lifetime — as MarkDrag and CropDrag do — and the session ends that
// lifetime, because a drag must not outlive the clip it was drawn on.
//
// How it goes: the section the user selected arms the gesture for its stretch, a
// drag across the preview draws the arrow over that stretch, and a click on an arrow
// that is already there picks it so its ends can be dragged. The clip announces
// every change, so this module redraws the preview when it hears one — it does not
// redraw because it happened to be the caller.

import { currentPhase } from '../state.js';
import { session } from '../session.js';
import { ctx, el, toast } from './dom.js';
import { Span } from '../domain/clip/Span.js';
import { Arrow } from '../domain/annotation/Arrow.js';
import type { Annotation } from '../domain/annotation/Annotation.js';
import { arrowRenderer, drawAnnotations } from './annotation-layer.js';
import { drawFrame } from './preview.js';
import { player } from './clip.js';
import { playback } from './playback.js';
import { clipboard } from './annotation-clipboard.js';
import { typingIn } from '../util.js';

const DRAG_MIN = 3;          // px of travel before a press counts as a drag
const GRIP_PX = 14;          // how near an end a press has to be to take hold of it
const PREVIEW_ID = 'preview';

interface Point { x: number; y: number }
// 'move' is the whole thing; anything else is one of the annotation's own handles.
type Grab = string;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

class ArrowEdit {
  private span: Span | null = null;     // the armed stretch, from the selection
  private live = false;                 // a new arrow is being drawn
  private from: Point = { x: 0, y: 0 };
  private to: Point = { x: 0, y: 0 };
  private pickId: string | null = null; // the annotation in hand, if any
  private grab: Grab | null = null;
  private last: Point = { x: 0, y: 0 };
  private fromX = 0;
  private fromY = 0;

  get selectedId(): string | null { return this.pickId; }
  get armed(): boolean { return this.span !== null; }

  /** Pick an annotation from outside the picture (the timeline lane). */
  pick(id: string | null): void {
    this.pickId = id;
    this.grab = null;
    announceSelection();
    repaint();
  }

  /** The section the user selected arms the gesture for its stretch. */
  arm(span: Span): void {
    this.span = span;
    this.pickId = null;
    el.cv.style.cursor = 'crosshair';
    // The frame under the gesture has to be one of the stretch's own. A playhead
    // sitting exactly on the section's end is outside its half-open span — the
    // second mark leaves it there — and the arrow would vanish the moment it was
    // made, because `annotationsAt` would have nothing to answer with.
    const total = session.clip.total();
    if (total > 0 && !span.contains(player.time() / total)) playback.hold(span.s * total);
    announceSelection();
    repaint();
  }

  /** The arrow in hand is gone (removed, or the session ended). */
  forget(id?: string): void {
    if (id && this.pickId !== id) return;
    this.pickId = null;
    this.grab = null;
    announceSelection();
  }

  /** The session is over, or the selection was dropped. */
  cancel(): void {
    this.span = null;
    this.live = false;
    this.grab = null;
    this.pickId = null;
    el.cv.style.cursor = '';
    announceSelection();
  }

  down(e: PointerEvent): void {
    if (currentPhase() !== 'review') return;
    const p = fractionAt(e.clientX, e.clientY);

    // Armed: this drag draws a new arrow over the armed stretch.
    if (this.span) {
      playback.pause();                    // a still frame's business, as a mark is
      this.live = true;
      this.from = this.to = p;
      this.fromX = e.clientX;
      e.preventDefault();
      return;
    }

    // Otherwise a press may pick an arrow that is already there.
    const hit = hitAnnotation(p);
    if (!hit) { this.forget(); repaint(); return; }
    const near = hit.handles().find(h => Math.hypot(h.x - p.x, h.y - p.y) * el.cv.clientWidth <= GRIP_PX);
    this.pickId = hit.id;
    this.grab = near ? near.end : 'move';
    this.last = p;
    this.fromX = e.clientX;
    this.fromY = e.clientY;
    playback.pause();
    announceSelection();
    repaint();
    e.preventDefault();
  }

  move(e: PointerEvent): void {
    if (currentPhase() !== 'review') return;
    const p = fractionAt(e.clientX, e.clientY);

    if (this.live) { this.to = p; repaint(); return; }
    if (!this.pickId || !this.grab) return;
    // Any direction counts: an arrow is aimed as often as it is slid sideways.
    if (Math.hypot(e.clientX - this.fromX, e.clientY - this.fromY) < DRAG_MIN) return;

    const annotation = session.clip.annotations.byId(this.pickId);
    if (!annotation) return;
    const dx = p.x - this.last.x, dy = p.y - this.last.y;
    this.last = p;

    // How it moves and aims is the annotation's own business — this only asks.
    const next = this.grab === 'move' ? annotation.movedBy(dx, dy) : annotation.withHandle(this.grab, p);
    // The clip announces the change, and the redraw is the listener's — not this.
    if (next) session.clip.changeAnnotation(annotation.id, next);
  }

  end(): void {
    if (this.live) {
      const span = this.span;
      const geometry = { from: this.from, to: this.to };
      this.live = false;
      if (span) {
        const annotation = Arrow.create(span, geometry.from, geometry.to);
        if (annotation) {
          session.clip.addAnnotation(annotation);
          this.span = null;                // the selection was spent on it
          el.cv.style.cursor = '';
        } else {
          // A stray click is not an arrow. Stay armed, so the next try is a drag
          // away rather than a selection to be made again.
          el.tCut.textContent = 'ARROW — drag across the picture';
        }
      }
      repaint();
      return;
    }
    this.grab = null;
  }

  /** The arrow being drawn, for the preview to show before it is committed. */
  preview(): Arrow | null {
    if (!this.live) return null;
    return Arrow.create(this.span ?? Span.of(0, 1), this.from, this.to, PREVIEW_ID);
  }
}

export const edit = new ArrowEdit();

// Who wants to know when the arrow in hand changes — the timeline lane, so its
// selected bar follows the picture. The view listens; nothing calls into it.
const selectionListeners = new Set<() => void>();

export function onSelectionChange(fn: () => void): void {
  selectionListeners.add(fn);
}

function announceSelection(): void {
  for (const fn of [...selectionListeners]) fn();
}

export function initAnnotationEdit(): void {
  el.cv.addEventListener('pointerdown', e => edit.down(e));
  window.addEventListener('pointermove', e => edit.move(e));
  window.addEventListener('pointerup', () => edit.end());
  window.addEventListener('pointercancel', () => edit.end());

  // Escape lets go of an armed arrow or of the one in hand; Delete takes the picked
  // one away, because reaching for the × on its timeline bar is a longer trip than
  // pressing the key that means "remove this". The one undo brings it back.
  window.addEventListener('keydown', evt => {
    if (typingIn(evt.target)) return;             // a field's Delete belongs to the field

    if (evt.key === 'Escape') {
      if (!edit.armed && !edit.selectedId) return;
      if (edit.armed) edit.cancel();
      else            edit.forget();
      repaint();
      return;
    }

    // Delete is Supr; on a Mac keyboard the same key is Backspace.
    if ((evt.key === 'Delete' || evt.key === 'Backspace') && edit.selectedId && currentPhase() === 'review') {
      evt.preventDefault();
      session.clip.removeAnnotation(edit.selectedId);   // the clip announces it; the view follows
      return;
    }

    // Copy the arrow in hand, and paste a new one of the same shape where the playhead
    // holds — how a callout is repeated at another moment without selecting a stretch
    // and drawing it again. The browser's own copy is left alone when nothing is
    // picked, so copying selected text still works.
    const key = evt.key.toLowerCase();
    if (!(evt.metaKey || evt.ctrlKey) || (key !== 'c' && key !== 'v')) return;
    if (currentPhase() !== 'review') return;

    if (key === 'c' && edit.selectedId) {
      const picked = session.clip.annotations.byId(edit.selectedId);
      if (!picked) return;
      evt.preventDefault();
      clipboard.copy(picked);
      toast('Arrow copied');
      return;
    }

    if (key === 'v' && clipboard.has) {
      const pasted = pasteAtPlayhead();
      if (!pasted) return;
      evt.preventDefault();
      toast('Arrow pasted — drag its mark to move it');
    }
  });

  // The clip says what changed; this is where the preview follows.
  session.clip.onChange(event => {
    if (event.type === 'cleared') { edit.cancel(); return; }
    if (event.type === 'annotation-removed') edit.forget(event.annotation.id);
    if (event.type === 'annotation-added' || event.type === 'annotation-changed' || event.type === 'annotation-removed') repaint();
  });
}

/** Redraw the frame under the gesture, the annotations, and the arrow being drawn. */
export function repaint(): void {
  if (currentPhase() !== 'review' || el.rv.readyState < 1) return;
  const w = el.cv.width, h = el.cv.height;
  try { drawFrame(el.rv); } catch { return; }        // a frame still decoding
  drawAnnotations(ctx, w, h, session.clip.annotationsAt(player.time()), edit.selectedId);
  const live = edit.preview();
  if (live) arrowRenderer.draw(ctx, live, w, h);
}

// A new arrow of the copied shape, over the same part of the picture, at the moment
// the playhead holds — kept inside the clip, and in hand at once so its grips show.
function pasteAtPlayhead(): Annotation | null {
  const total = session.clip.total();
  if (!(total > 0) || !clipboard.has) return null;
  const length = clipboard.length;
  const at = Math.max(0, Math.min(1 - length, player.time() / total));
  const pasted = clipboard.paste(Span.of(at, at + length));
  if (!pasted) return null;
  session.clip.addAnnotation(pasted);      // the clip announces it; the views follow
  edit.pick(pasted.id);
  return pasted;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fractionAt(clientX: number, clientY: number): Point {
  const r = el.cv.getBoundingClientRect();
  return {
    x: clamp01(r.width > 0 ? (clientX - r.left) / r.width : 0),
    y: clamp01(r.height > 0 ? (clientY - r.top) / r.height : 0),
  };
}

// The topmost annotation under a point, at the moment the playhead holds. The hit
// test is the annotation's own, because how close is close enough is geometry.
function hitAnnotation(p: Point): Annotation | null {
  const shown = session.clip.annotationsAt(player.time());
  const w = el.cv.width, h = el.cv.height;
  for (let i = shown.length - 1; i >= 0; i--) {
    if (shown[i].hitTest(p.x, p.y, w, h, Math.max(9, w / 55))) return shown[i];
  }
  return null;
}
