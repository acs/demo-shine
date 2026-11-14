// Rectangular crop region drawn over the live capture.
//
// The region is always shown as a red box over the preview — by default it
// covers the whole source. Drag to select a smaller region (only it is
// recorded); a plain click resets back to the full source. The overlay is
// painted straight onto the preview canvas, so it can never end up in the
// recording (which reads from the source <video>).

import { app, type Rect } from '../state.js';
import { el, ctx } from './dom.js';

export const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 };

export function isFullRegion(r: Rect): boolean {
  return r.x <= 0.001 && r.y <= 0.001 && r.w >= 0.999 && r.h >= 0.999;
}

const MIN_PX = 16;               // below this a pointer gesture counts as a click

let dragging = false;
let sX = 0, sY = 0, cX = 0, cY = 0;   // canvas pixels

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export function initRegion(): void {
  el.cv.addEventListener('pointerdown', onDown);
  el.cv.addEventListener('pointermove', onMove);
  el.cv.addEventListener('pointerup', onUp);
  el.cv.addEventListener('pointercancel', onUp);
}

// Back to the whole source.
export function clearRegion(): void {
  app.region = { ...FULL };
}

function toCanvas(e: PointerEvent): { x: number; y: number } {
  const r = el.cv.getBoundingClientRect();
  return {
    x: clamp((e.clientX - r.left) / r.width  * el.cv.width,  0, el.cv.width),
    y: clamp((e.clientY - r.top)  / r.height * el.cv.height, 0, el.cv.height),
  };
}

function onDown(e: PointerEvent): void {
  if (app.phase !== 'live') return;
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
  if (w < MIN_PX || h < MIN_PX) { clearRegion(); return; }   // a click → full source

  const x = Math.min(sX, cX), y = Math.min(sY, cY);
  app.region = { x: x / el.cv.width, y: y / el.cv.height, w: w / el.cv.width, h: h / el.cv.height };
}

// Painted by the live mirror loop on the preview canvas.
export function drawRegion(): void {
  const live = app.phase === 'live' || app.phase === 'recording';
  el.cv.style.cursor = app.phase === 'live' ? 'crosshair' : '';
  if (!live) return;

  const W = el.cv.width, H = el.cv.height;
  const fs = Math.max(11, Math.round(W / 55));   // font / stroke scale

  let rect = app.region;
  if (dragging) {
    rect = {
      x: Math.min(sX, cX) / W, y: Math.min(sY, cY) / H,
      w: Math.abs(cX - sX) / W, h: Math.abs(cY - sY) / H,
    };
  }

  const x = rect.x * W, y = rect.y * H, w = rect.w * W, h = rect.h * H;
  const lw = Math.max(1.5, W / 480);
  const full = isFullRegion(rect);

  ctx.save();
  // Dim everything outside the region (empty for the full region).
  ctx.fillStyle = 'rgba(2,3,8,0.62)';
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.rect(x, y, w, h);
  ctx.fill('evenodd');

  // Red box, inset a hair so the stroke is never clipped at the edges.
  const ix = x + lw / 2, iy = y + lw / 2, iw = Math.max(0, w - lw), ih = Math.max(0, h - lw);
  ctx.strokeStyle = '#E53E3E';
  ctx.lineWidth = lw;
  ctx.strokeRect(ix, iy, iw, ih);

  // Corner ticks.
  ctx.fillStyle = '#E53E3E';
  const t = lw * 4;
  for (const [px, py] of [[ix, iy], [ix + iw, iy], [ix, iy + ih], [ix + iw, iy + ih]]) {
    ctx.fillRect(px - t / 2, py - lw / 2, t, lw);
    ctx.fillRect(px - lw / 2, py - t / 2, lw, t);
  }

  // Size readout, inside the box near the top.
  const label = `${Math.round(rect.w * app.captureW)} × ${Math.round(rect.h * app.captureH)}`;
  tag(label, x + w / 2, y + fs * 1.9, W, fs);

  if (app.phase === 'live') hint(full ? 'Drag to record a region' : 'Click to reset to the full screen', W, H, fs);
  ctx.restore();
}

function hint(text: string, W: number, H: number, fs: number): void {
  ctx.font = `${fs}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(W / 2 - tw / 2 - fs, H - fs * 3.4, tw + fs * 2, fs * 2);
  ctx.fillStyle = 'rgba(228,230,240,0.85)';
  ctx.fillText(text, W / 2, H - fs * 2.4);
}

function tag(text: string, cx: number, cy: number, W: number, fs: number): void {
  ctx.font = `${fs}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width;
  const bx = clamp(cx, tw / 2 + fs, W - tw / 2 - fs) - tw / 2 - fs / 2;
  ctx.fillStyle = 'rgba(229,62,62,0.92)';
  ctx.fillRect(bx, cy - fs, tw + fs, fs * 2);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, clamp(cx, tw / 2 + fs, W - tw / 2 - fs), cy);
}
