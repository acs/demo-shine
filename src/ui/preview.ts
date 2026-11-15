// Preview canvas rendering, the review-video seeking primitives and the live
// mirror loop.

import { el, ctx } from './dom.js';
import { app } from '../state.js';
import { drawRegion } from './region.js';
import { drawWebcamOverlay } from './webcam.js';

export function drawGrid(): void {
  const light = document.documentElement.dataset.theme === 'light';
  ctx.clearRect(0, 0, el.cv.width, el.cv.height);
  ctx.fillStyle = light ? '#ECF0FA' : '#050508';
  ctx.fillRect(0, 0, el.cv.width, el.cv.height);
  ctx.strokeStyle = light ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 1;
  const g = 90;
  for (let x = 0; x <= el.cv.width; x += g) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, el.cv.height); ctx.stroke(); }
  for (let y = 0; y <= el.cv.height; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(el.cv.width, y); ctx.stroke(); }
  const mx = el.cv.width / 2, my = el.cv.height / 2;
  ctx.strokeStyle = light ? 'rgba(229,62,62,0.14)' : 'rgba(229,62,62,0.08)';
  ctx.beginPath(); ctx.arc(mx, my, 40, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(mx, my, 10, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx - 62, my); ctx.lineTo(mx + 62, my); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx, my - 62); ctx.lineTo(mx, my + 62); ctx.stroke();
}

export function drawFrame(vid: HTMLVideoElement): void {
  ctx.drawImage(vid, 0, 0, el.cv.width, el.cv.height);
}

export function seekTo(vid: HTMLVideoElement, t: number): Promise<void> {
  return new Promise(res => {
    const fn = () => { vid.removeEventListener('seeked', fn); res(); };
    vid.addEventListener('seeked', fn);
    vid.currentTime = Math.min(Math.max(t, 0), vid.duration || 0);
  });
}

// A seek that gives up instead of waiting forever, reporting whether it landed.
// MediaRecorder WebM carries no duration in its header, and seeking such a file
// can stall; a stalled seek must never wedge playback or an export.
export function seekWithin(vid: HTMLVideoElement, t: number, ms = 2500): Promise<boolean> {
  return new Promise(res => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      vid.removeEventListener('seeked', onSeeked);
      clearTimeout(timer);
      res(ok);
    };
    const onSeeked = () => finish(true);
    const timer = setTimeout(() => finish(false), ms);
    vid.addEventListener('seeked', onSeeked);
    vid.currentTime = Math.min(Math.max(t, 0), vid.duration || 0);
  });
}

// Live mirror: show the captured screen on the preview canvas during countdown.
export function startMirror(): void {
  app.mirroring = true;
  (function loop() {
    if (!app.mirroring) return;
    if (el.sv.readyState >= 2) {
      drawFrame(el.sv);
      drawRegion();
      // Webcam overlay, inside the recording region (what will be recorded).
      drawWebcamOverlay(ctx, app.region.x * el.cv.width, app.region.y * el.cv.height,
                             app.region.w * el.cv.width, app.region.h * el.cv.height);
    }
    app.rafId = requestAnimationFrame(loop);
  })();
}

export function stopMirror(): void {
  app.mirroring = false;
  if (app.rafId) { cancelAnimationFrame(app.rafId); app.rafId = null; }
}
