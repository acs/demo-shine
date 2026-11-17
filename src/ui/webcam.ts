// The webcam source.
//
// A toggle starts the camera. With the screen on it is a bubble in the
// bottom-right of the recording region, drawn both on the live preview and on
// the recorded canvas, so what you see is exactly what gets recorded; with the
// screen off the camera is the whole picture (recorder.ts).

import { app } from '../state.js';
import { el, toast } from './dom.js';

export function initWebcam(): void {
  el.webcamBtn.disabled = true;                 // until we know a camera exists
  if (navigator.mediaDevices) {
    navigator.mediaDevices.addEventListener('devicechange', () => void detectWebcam());
  }
  void detectWebcam();
}

export async function detectWebcam(): Promise<void> {
  let has = false;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    has = devices.some(d => d.kind === 'videoinput');
  } catch { /* no mediaDevices / blocked */ }
  el.webcamBtn.disabled = !has;
  if (!has) stopWebcam();
}

// Async, so the caller can sync the preview once the camera is really on.
export async function toggleWebcam(): Promise<void> {
  if (app.webcamOn) stopWebcam();
  else              await startWebcam();
}

async function startWebcam(): Promise<void> {
  if (app.webcamOn) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    app.webcamStream = stream;
    el.wcv.srcObject = stream;
    await el.wcv.play();
    app.webcamOn = true;
    el.webcamBtn.classList.add('active');
    el.webcamBtn.setAttribute('aria-pressed', 'true');
  } catch (err) {
    const name = (err as { name?: string }).name;
    toast('Could not start the webcam' + (name ? ` (${name})` : ''), 4000);
  }
}

export function stopWebcam(): void {
  if (app.webcamStream) { app.webcamStream.getTracks().forEach(t => t.stop()); app.webcamStream = null; }
  app.webcamOn = false;
  el.wcv.srcObject = null;
  el.webcamBtn.classList.remove('active');
  el.webcamBtn.setAttribute('aria-pressed', 'false');
}

// Paint the webcam, mirrored, as a circle in the bottom-right of a box.
export function drawWebcamOverlay(c: CanvasRenderingContext2D, boxX: number, boxY: number, boxW: number, boxH: number): void {
  const v = el.wcv;
  if (!app.webcamOn || v.readyState < 2 || !v.videoWidth) return;

  const d = Math.round(boxW * 0.15);            // circle diameter (15% of the box)
  const m = Math.round(boxW * 0.03);            // margin from the corner
  const cx = boxX + boxW - m - d / 2;
  const cy = boxY + boxH - m - d / 2;

  // Scale the video to cover the circle (centre-cropped, no letterboxing).
  const scale = Math.max(d / v.videoWidth, d / v.videoHeight);
  const dw = v.videoWidth * scale;
  const dh = v.videoHeight * scale;

  c.save();
  c.beginPath();
  c.arc(cx, cy, d / 2, 0, Math.PI * 2);
  c.clip();
  c.translate(cx, cy);
  c.scale(-1, 1);                               // mirror like a selfie
  c.drawImage(v, -dw / 2, -dh / 2, dw, dh);
  c.restore();

  c.save();
  c.beginPath();
  c.arc(cx, cy, d / 2, 0, Math.PI * 2);
  c.strokeStyle = 'rgba(255,255,255,0.72)';
  c.lineWidth = Math.max(1.25, d / 30);
  c.stroke();
  c.restore();
}
