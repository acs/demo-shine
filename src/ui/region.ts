// Rectangular crop region drawn over the live capture.
//
// Drag on the preview to select a region; only that region is recorded. The
// overlay is painted straight onto the preview canvas (so it can never end up
// in the recording, which reads from the source <video>). Double-click clears.

import { app } from '../state.js';
import { el, ctx } from './dom.js';

const MIN_PX = 16;              // ignore tiny accidental drags

let dragging = false;
let sX = 0, sY = 0, cX = 0, cY = 0;   // canvas pixels

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export function initRegion(): void {
  el.cv.addEventListener('pointerdown', onDown);
  el.cv.addEventListener('pointermove', onMove);
  el.cv.addEventListener('pointerup', onUp);
  el.cv.addEventListener('pointercancel', onUp);
  el.cv.addEventListener('dblclick', clearRegion);
}

export function clearRegion(): void {
  if (dragging) return;
  app.region = null;
}

export function hasRegion(): boolean {
  return app.region !== null;
}

function toCanvas(e: PointerEvent): { x: number; y: number } {
  const r = el.cv.getBoundingClientRect();
  return {
    x: clamp((e.clientX - r.left) / r.width  * el.cv.width,  0, el.cv.width),
    y: clamp((e.clientY - r.top)  / r.height * el.cv.height, 0, el.cv.height),
  };
}

function onDown(e: PointerEvent): void {
  if (app.phase !== 'live') return;   // only while the capture is live
  const p = toCanvas(e);
  dragging = true; sX = cX = p.x; sY = cY = p.y;
  try { el.cv.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
  e.preventDefault();
}

function onMove(e: PointerEvent): void {
  if (!dragging) return;
  const p = toCanvas(e);
  cX = p.x; cY = p.y;
}

function onUp(e: PointerEvent): void {
  if (!dragging) return;
  dragging = false;
  try { el.cv.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  const w = Math.abs(cX - sX), h = Math.abs(cY - sY);
  if (w < MIN_PX || h < MIN_PX) { app.region = null; return; }   // treat as a click
  const x = Math.min(sX, cX), y = Math.min(sY, cY);
  app.region = { x: x / el.cv.width, y: y / el.cv.height, w: w / el.cv.width, h: h / el.cv.height };
}

// Painted by the live mirror loop on the preview canvas.
export function drawRegion(): void {
  const live = app.phase === 'live' || app.phase === 'recording';
  el.cv.style.cursor = app.phase === 'live' ? 'crosshair' : '';
  if (!live) return;

  const W = el.cv.width, H = el.cv.height;

  let rect = app.region;
  if (dragging) {
    rect = {
      x: Math.min(sX, cX) / W, y: Math.min(sY, cY) / H,
      w: Math.abs(cX - sX) / W, h: Math.abs(cY - sY) / H,
    };
  }

  if (!rect) { hint(W, H); return; }

  const x = rect.x * W, y = rect.y * H, w = rect.w * W, h = rect.h * H;
  const lw = Math.max(1.5, W / 480);

  ctx.save();
  // Dim everything outside the region (single even-odd fill).
  ctx.fillStyle = 'rgba(2,3,8,0.62)';
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.rect(x, y, w, h);
  ctx.fill('evenodd');
  // Border + corner ticks.
  ctx.strokeStyle = '#E53E3E';
  ctx.lineWidth = lw;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#E53E3E';
  const t = lw * 4;
  for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
    ctx.fillRect(px - t / 2, py - lw / 2, t, lw);
    ctx.fillRect(px - lw / 2, py - t / 2, lw, t);
  }
  // Size readout.
  const label = `${Math.round(rect.w * app.captureW)} × ${Math.round(rect.h * app.captureH)}`;
  tag(label, x + w / 2, y + h + lw * 7, W, H);
  ctx.restore();
}

function hint(W: number, H: number): void {
  const size = Math.max(11, Math.round(W / 55));
  ctx.save();
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  const text = 'Drag to record a region';
  const tw = ctx.measureText(text).width;
  ctx.fillRect(W / 2 - tw / 2 - size, H - size * 4, tw + size * 2, size * 2.4);
  ctx.fillStyle = 'rgba(228,230,240,0.85)';
  ctx.fillText(text, W / 2, H - size * 2.8);
  ctx.restore();
}

function tag(text: string, cx: number, cy: number, W: number, H: number): void {
  const size = Math.max(11, Math.round(W / 55));
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width;
  const y = clamp(cy, size * 1.6, H - size * 1.6);
  ctx.fillStyle = 'rgba(229,62,62,0.92)';
  ctx.fillRect(clamp(cx, tw / 2 + size, W - tw / 2 - size) - tw / 2 - size / 2, y - size, tw + size, size * 2);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, clamp(cx, tw / 2 + size, W - tw / 2 - size), y);
}
