// The webcam source.
//
// A toggle starts the camera. With the screen on it is a bubble in the bottom-right
// of the capture region; with the screen off it is the whole picture. The stream is
// acquired and released by the capture adapter; this view attaches it to the video
// element and draws the bubble.

import { capture } from '../infra/capture.js';
import { el, toast } from './dom.js';
import { setCameraPresent } from './source-buttons.js';

export function initWebcam(): void {
  setCameraPresent(false);                      // until we know a camera exists
  if (navigator.mediaDevices) {
    navigator.mediaDevices.addEventListener('devicechange', () => void detectWebcam());
  }
  void detectWebcam();
}

export async function detectWebcam(): Promise<void> {
  let has: boolean;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    has = devices.some(device => device.kind === 'videoinput');
  } catch {
    has = false;
  }
  setCameraPresent(has);
  if (!has) stopWebcam();
}

// Async, so the caller can sync the preview once the camera is really on.
export async function toggleWebcam(): Promise<void> {
  if (capture.sources.webcam) stopWebcam();
  else await startWebcam();
}

async function startWebcam(): Promise<void> {
  if (capture.sources.webcam) return;
  try {
    const stream = await capture.startWebcam();
    el.wcv.srcObject = stream;
    await el.wcv.play();
    el.webcamBtn.classList.add('active');
    el.webcamBtn.setAttribute('aria-pressed', 'true');
  } catch (error) {
    const name = (error as { name?: string }).name;
    toast('Could not start the webcam' + (name ? ` (${name})` : ''), 4000);
  }
}

export function stopWebcam(): void {
  capture.stopWebcam();
  el.wcv.srcObject = null;
  el.webcamBtn.classList.remove('active');
  el.webcamBtn.setAttribute('aria-pressed', 'false');
}

// Paint the webcam, mirrored, into the rectangle the compositor gives it.
export function drawWebcamOverlay(
  context: CanvasRenderingContext2D,
  x: number, y: number, width: number, height: number,
): void {
  if (!capture.sources.webcam || el.wcv.readyState < 2) return;
  const size = Math.min(width, height) * 0.28;
  const cx = x + width - size * 0.7;
  const cy = y + height - size * 0.7;
  context.save();
  context.beginPath();
  context.arc(cx + size / 2, cy + size / 2, size / 2, 0, Math.PI * 2);
  context.closePath();
  context.clip();
  context.translate(cx + size, cy);
  context.scale(-1, 1);
  context.drawImage(el.wcv, 0, 0, size, size);
  context.restore();
}
