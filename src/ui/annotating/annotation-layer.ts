// Drawing the annotations over the picture: the one place a kind is painted, and the
// grips every kind is edited by.
//
// One layer serves the preview and the export: `drawAnnotations` is called by the
// playback loop and by the offline export, each on its own canvas, in fractions of
// whichever canvas is handed in — so an annotation lands in the same place in the file
// as on the screen, whatever the two sizes are.
//
// Two things are drawn, and they are kept apart on purpose:
//
//   * the annotation itself, by the renderer a kind registers under its own id, in the
//     picture's own proportions — what it looks like is part of the picture and must
//     export the same;
//   * the **grips** a picked annotation is dragged by, here, once, for every kind —
//     they are an editing affordance, never exported, and sized in screen pixels so a
//     grip is the same size to the hand whatever the canvas resolution.
//
// A renderer draws and nothing else: how an annotation is picked, moved and resized is
// geometry, and lives on the class (`src/domain/annotation/`). Which renderer a kind
// has is part of its plugin (`annotation-plugin.ts`), registered here under the kind's
// id — the id is the whole of the coupling between the class, the plugin and the
// drawing.

import type { Annotation } from '../../domain/annotation/Annotation.js';

export interface AnnotationRenderer<A extends Annotation> {
  readonly id: string;
  /** Paint it, inside `w × h`, in the picture's own proportions. */
  draw(ctx: CanvasRenderingContext2D, annotation: A, w: number, h: number): void;
}

/** A renderer with its annotation erased, which is how the registry holds them. */
interface AnyRenderer {
  readonly id: string;
  draw(ctx: CanvasRenderingContext2D, annotation: Annotation, w: number, h: number): void;
}

const renderers = new Map<string, AnyRenderer>();

export function registerRenderer<A extends Annotation>(renderer: AnnotationRenderer<A>): void {
  renderers.set(renderer.id, {
    id: renderer.id,
    draw: (ctx, annotation, w, h) => renderer.draw(ctx, annotation as A, w, h),
  });
}

export function rendererOf(id: string): AnyRenderer | null {
  return renderers.get(id) ?? null;
}

/** Paint every annotation shown at this moment, in order, and the picked one's grips. */
export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  annotations: readonly Annotation[],
  selectedId: string | null = null,
): void {
  for (const annotation of annotations) {
    renderers.get(annotation.kind)?.draw(ctx, annotation, w, h);
  }
  const picked = selectedId === null ? null : annotations.find(a => a.id === selectedId);
  if (picked) drawHandles(ctx, picked, w, h);
}

// ── the grips ────────────────────────────────────────────────────────────────
//
// Where a picked annotation can be dragged, drawn from the annotation's own
// `handles()` — so a kind gets the same grip UI without writing any, which is the
// point of it living here rather than in each renderer.
//
// The picked annotation carries two controls the grips do not: the × that takes it
// away, and the copy that puts another like it beside it. A phone has no Delete key and
// no ⌘C, and a press on either must not be a press that aims — so both sit off the
// annotation rather than on it, on opposite sides of its middle. `removeControl` and
// `copyControl` are the one place each says where, and `annotation-canvas.ts` hit-tests
// the same two points.

// Canvas pixels per screen pixel: a grip must be the same size to the hand whatever
// the picture's resolution. 1 when the canvas is not on screen, which is what an
// export's canvas is — and nothing is picked during an export anyway.
function screenScale(ctx: CanvasRenderingContext2D): number {
  const css = (ctx.canvas as HTMLCanvasElement | undefined)?.clientWidth ?? 0;
  return css > 0 ? ctx.canvas.width / css : 1;
}

const CONTROL_GAP = 22;  // screen px from the annotation's middle to a control, so it clears it
const CONTROL_R   = 12;  // screen px: bigger than a grip — a button, and a finger's, not a cursor's

type Control = 'remove' | 'copy';

// Which side of the middle a control sits on: the × on one, the copy on the other.
function controlSpot(
  annotation: Annotation, w: number, h: number, scale: number, side: 1 | -1,
): { x: number; y: number } | null {
  const ends = annotation.handles();
  if (ends.length < 2) return null;
  const a = ends[0], b = ends[ends.length - 1];
  const dx = (b.x - a.x) * w, dy = (b.y - a.y) * h;
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
  const gap = CONTROL_GAP * scale * side;
  const x = ((a.x + b.x) / 2) * w - (dy / len) * gap;
  const y = ((a.y + b.y) / 2) * h + (dx / len) * gap;
  const clamp = (v: number, hi: number) => (v < 0 ? 0 : v > hi ? hi : v);
  return { x: clamp(x, w) / w, y: clamp(y, h) / h };
}

/**
 * Where the picked annotation's remove control sits, in fractions of the picture — or
 * null when there is no pair of ends to hang it off. It is off to one side of the
 * middle, so a press on it can never be a press that aims. `scale` is canvas px per
 * screen px.
 */
export function removeControl(
  annotation: Annotation, w: number, h: number, scale: number,
): { x: number; y: number } | null {
  return controlSpot(annotation, w, h, scale, 1);
}

/** Where the copy control sits: the same, on the other side of the middle. */
export function copyControl(
  annotation: Annotation, w: number, h: number, scale: number,
): { x: number; y: number } | null {
  return controlSpot(annotation, w, h, scale, -1);
}

const ACCENT = '#e53e3e';

function drawHandles(ctx: CanvasRenderingContext2D, annotation: Annotation, w: number, h: number): void {
  const scale = screenScale(ctx);
  const r = 5 * scale;
  ctx.save();
  for (const handle of annotation.handles()) {
    ctx.beginPath();
    ctx.arc(handle.x * w, handle.y * h, r, 0, Math.PI * 2);
    ctx.fillStyle = ACCENT;
    ctx.fill();
    ctx.lineWidth = Math.max(1, 1.5 * scale);
    ctx.strokeStyle = '#fff';           // a light ring, so it reads over a dark picture
    ctx.stroke();
  }
  const controls: Array<[Control, { x: number; y: number } | null]> = [
    ['remove', removeControl(annotation, w, h, scale)],
    ['copy', copyControl(annotation, w, h, scale)],
  ];
  for (const [control, spot] of controls) {
    if (spot) drawControl(ctx, control, spot.x * w, spot.y * h, CONTROL_R * scale, scale);
  }
  ctx.restore();
}

// A control on the picked annotation: the grips' own disc and ring, so it reads as one
// of its controls rather than a new thing, with its mark cut into it.
function drawControl(ctx: CanvasRenderingContext2D, control: Control, x: number, y: number, r: number, scale: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = ACCENT;
  ctx.fill();
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  ctx.strokeStyle = '#fff';
  ctx.stroke();

  ctx.lineWidth = Math.max(1, 1.8 * scale);
  ctx.strokeStyle = '#fff';

  if (control === 'remove') {
    const k = r * 0.42;
    ctx.beginPath();
    ctx.moveTo(x - k, y - k);
    ctx.lineTo(x + k, y + k);
    ctx.moveTo(x + k, y - k);
    ctx.lineTo(x - k, y + k);
    ctx.stroke();
    return;
  }

  // Two sheets: the far one behind, the near one filled in the disc's own colour so it
  // knocks the overlap out and the two read apart at this size. The pair is centred on
  // the disc, so the mark does not lean.
  const k = r * 0.40, off = r * 0.30;
  const sheet = (cx: number, cy: number) => {
    ctx.beginPath();
    ctx.moveTo(cx - k, cy - k);
    ctx.lineTo(cx + k, cy - k);
    ctx.lineTo(cx + k, cy + k);
    ctx.lineTo(cx - k, cy + k);
    ctx.closePath();
  };
  sheet(x + off, y - off);        // the far one, up and to the right, solid
  ctx.fillStyle = '#fff';
  ctx.fill();
  sheet(x - off, y + off);        // the near one, over it, cut out of the disc
  ctx.fillStyle = ACCENT;
  ctx.fill();
  ctx.stroke();
}
