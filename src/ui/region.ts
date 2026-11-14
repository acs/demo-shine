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

// A small, consistent on-screen font size, whatever the capture resolution.
function fontPx(): number {
  const W  = el.cv.width;
  const cw = el.cv.clientWidth || W;
  const cssPx = Math.max(9, Math.min(11, Math.round(cw / 95)));
  return Math.max(8, Math.round(cssPx * W / cw));
}

// Painted by the live mirror loop on the preview canvas.
export function drawRegion(): void {
  const live = app.phase === 'live' || app.phase === 'recording';
  el.cv.style.cursor = app.phase === 'live' ? 'crosshair' : '';
  if (!live) return;

  const W = el.cv.width, H = el.cv.height;
  const fs = fontPx();

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

  // Size readout — small, tucked outside the top-right corner.
  sizeBadge(
    `${Math.round(rect.w * app.captureW)} × ${Math.round(rect.h * app.captureH)}`,
    x + w, y, W, fs,
  );

  if (app.phase === 'live') hint(full ? 'Drag to record a region' : 'Click to reset to the full screen', W, H, fs);
  ctx.restore();
}

function sizeBadge(text: string, right: number, top: number, W: number, fs: number): void {
  ctx.font = `${fs}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width;
  const bw = tw + fs * 1.1, bh = fs * 1.8;

  const bx = clamp(right - bw, 2, Math.max(2, W - bw - 2));   // right-aligned to the box
  let by = top - bh - fs * 0.35;                              // above the box (outside)
  if (by < 2) by = top + fs * 0.35;                           // no room above → tuck inside

  ctx.fillStyle = 'rgba(6,7,16,0.82)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = 'rgba(228,230,240,0.95)';
  ctx.fillText(text, bx + fs * 0.55, by + bh / 2);
}

function hint(text: string, W: number, H: number, fs: number): void {
  const hfs = Math.round(fs * 1.25);
  ctx.font = `${hfs}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(W / 2 - tw / 2 - hfs, H - hfs * 3.4, tw + hfs * 2, hfs * 2);
  ctx.fillStyle = 'rgba(228,230,240,0.85)';
  ctx.fillText(text, W / 2, H - hfs * 2.4);
}
