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

import { app } from '../state.js';
import { ctx, el } from './dom.js';
import type { Span } from '../domain/clip/Span.js';
import { createAnnotation, type AnyAnnotation } from '../domain/annotation/Annotation.js';
import { arrowKind, type ArrowGeometry } from '../domain/annotation/Arrow.js';
import { arrowRenderer, drawAnnotations, rendererOf } from './annotation-layer.js';
import { drawFrame } from './preview.js';
import { player } from './clip.js';
import { playback } from './playback.js';

const DRAG_MIN = 3;          // px of travel before a press counts as a drag
const GRIP_PX = 14;          // how near an end a press has to be to take hold of it

interface Point { x: number; y: number }
type Grab = 'from' | 'to' | 'move';

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
    if (app.phase !== 'review') return;
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
    const handles = rendererOf(hit.kind)?.handles(hit.geometry) ?? [];
    const near = handles.find(h => Math.hypot(h.x - p.x, h.y - p.y) * el.cv.clientWidth <= GRIP_PX);
    this.pickId = hit.id;
    this.grab = near ? near.end : 'move';
    this.last = p;
    this.fromX = e.clientX;
    playback.pause();
    announceSelection();
    repaint();
    e.preventDefault();
  }

  move(e: PointerEvent): void {
    if (app.phase !== 'review') return;
    const p = fractionAt(e.clientX, e.clientY);

    if (this.live) { this.to = p; repaint(); return; }
    if (!this.pickId || !this.grab) return;
    if (Math.abs(e.clientX - this.fromX) < DRAG_MIN) return;

    const annotation = app.clip.annotations.byId(this.pickId);
    if (!annotation) return;
    const g = annotation.geometry as ArrowGeometry;
    const dx = p.x - this.last.x, dy = p.y - this.last.y;
    this.last = p;

    const next: ArrowGeometry = this.grab === 'from' ? { from: p, to: g.to }
      : this.grab === 'to' ? { from: g.from, to: p }
      : { from: { x: g.from.x + dx, y: g.from.y + dy }, to: { x: g.to.x + dx, y: g.to.y + dy } };

    // The clip announces the change, and the redraw is the listener's — not this.
    app.clip.changeAnnotation(annotation.id, { ...annotation, geometry: arrowKind.normalize(next) });
  }

  end(): void {
    if (this.live) {
      const span = this.span;
      const geometry = { from: this.from, to: this.to };
      this.live = false;
      if (span) {
        const annotation = createAnnotation('arrow', span, geometry);
        if (annotation) app.clip.addAnnotation(annotation);
        this.span = null;                  // the selection was spent on it
        el.cv.style.cursor = '';
      }
      repaint();
      return;
    }
    this.grab = null;
  }

  /** The arrow being drawn, for the preview to show before it is committed. */
  preview(): ArrowGeometry | null {
    return this.live ? { from: this.from, to: this.to } : null;
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

  // The clip says what changed; this is where the preview follows.
  app.clip.onChange(event => {
    if (event.type === 'cleared') { edit.cancel(); return; }
    if (event.type === 'annotation-removed') edit.forget(event.annotation.id);
    if (event.type === 'annotation-added' || event.type === 'annotation-changed' || event.type === 'annotation-removed') repaint();
  });
}

/** Redraw the frame under the gesture, the annotations, and the arrow being drawn. */
export function repaint(): void {
  if (app.phase !== 'review' || el.rv.readyState < 1) return;
  const w = el.cv.width, h = el.cv.height;
  try { drawFrame(el.rv); } catch { return; }        // a frame still decoding
  drawAnnotations(ctx, w, h, app.clip.annotationsAt(player.time()), edit.selectedId);
  const live = edit.preview();
  if (live) arrowRenderer.draw(ctx, live, w, h, false);
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fractionAt(clientX: number, clientY: number): Point {
  const r = el.cv.getBoundingClientRect();
  return {
    x: clamp01(r.width > 0 ? (clientX - r.left) / r.width : 0),
    y: clamp01(r.height > 0 ? (clientY - r.top) / r.height : 0),
  };
}

// The topmost annotation under a point, at the moment the playhead holds.
function hitAnnotation(p: Point): AnyAnnotation | null {
  const shown = app.clip.annotationsAt(player.time());
  const w = el.cv.width, h = el.cv.height;
  for (let i = shown.length - 1; i >= 0; i--) {
    if (rendererOf(shown[i].kind)?.hitTest(shown[i].geometry, p.x, p.y, w, h)) return shown[i];
  }
  return null;
}
