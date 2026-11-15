// Webcam picture-in-picture.
//
// A header toggle starts the webcam and shows it, mirrored, in the bottom-right
// of the recording region. The overlay is drawn both on the live preview and on
// the recorded canvas, so what you see is exactly what gets recorded.

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

export function toggleWebcam(): void {
  if (app.webcamOn) stopWebcam();
  else              void startWebcam();
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

// Paint the webcam, mirrored, into the bottom-right of a box.
export function drawWebcamOverlay(c: CanvasRenderingContext2D, boxX: number, boxY: number, boxW: number, boxH: number): void {
  const v = el.wcv;
  if (!app.webcamOn || v.readyState < 2 || !v.videoWidth) return;

  const w = Math.round(boxW * 0.24);
  const h = Math.round(w * v.videoHeight / v.videoWidth);
  const m = Math.round(boxW * 0.03);
  const x = boxX + boxW - w - m;
  const y = boxY + boxH - h - m;

  c.save();
  c.translate(x + w / 2, y + h / 2);
  c.scale(-1, 1);                               // mirror like a selfie
  c.drawImage(v, -w / 2, -h / 2, w, h);
  c.restore();

  c.save();
  c.strokeStyle = 'rgba(255,255,255,0.65)';
  c.lineWidth = Math.max(1.5, boxW / 420);
  c.strokeRect(x, y, w, h);
  c.restore();
}
