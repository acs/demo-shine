// Microphone capture with a level (VU) meter.
//
// A header toggle starts the microphone; its level is shown in a small VU meter
// next to the button. When on, the mic is mixed with the capture's system audio
// in the recording (see recorder.ts).

import { app } from '../state.js';
import { el, toast } from './dom.js';

let vuCtx: AudioContext | null = null;
let vuAnalyser: AnalyserNode | null = null;
let vuRaf = 0;

export function initMic(): void {
  el.micBtn.disabled = true;                    // until we know a mic exists
  if (navigator.mediaDevices) {
    navigator.mediaDevices.addEventListener('devicechange', () => void detectMic());
  }
  void detectMic();
}

export async function detectMic(): Promise<void> {
  let has = false;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    has = devices.some(d => d.kind === 'audioinput');
  } catch { /* no mediaDevices / blocked */ }
  el.micBtn.disabled = !has;
  if (!has) stopMic();
}

export function toggleMic(): void {
  if (app.micOn) stopMic();
  else           void startMic();
}

async function startMic(): Promise<void> {
  if (app.micOn) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    app.micStream = stream;
    app.micOn = true;
    el.micBtn.classList.add('active');
    el.micBtn.setAttribute('aria-pressed', 'true');
    startVu(stream);
  } catch (err) {
    const name = (err as { name?: string }).name;
    toast('Could not start the microphone' + (name ? ` (${name})` : ''), 4000);
  }
}

export function stopMic(): void {
  if (app.micStream) { app.micStream.getTracks().forEach(t => t.stop()); app.micStream = null; }
  app.micOn = false;
  el.micBtn.classList.remove('active');
  el.micBtn.setAttribute('aria-pressed', 'false');
  stopVu();
}

function startVu(stream: MediaStream): void {
  stopVu();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  vuCtx = new Ctx();
  const src = vuCtx.createMediaStreamSource(stream);
  vuAnalyser = vuCtx.createAnalyser();
  vuAnalyser.fftSize = 1024;
  src.connect(vuAnalyser);                      // not routed to speakers — no feedback
  void vuCtx.resume();

  el.vu.classList.add('on');
  const buf = new Uint8Array(vuAnalyser.fftSize);
  let level = 0;
  (function loop() {
    if (!vuAnalyser) return;
    vuAnalyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
    const rms = Math.sqrt(sum / buf.length);
    const target = Math.min(1, rms * 3.2);        // a little gain so it reads well
    level = target > level ? target : level * 0.82; // fast attack, slow release
    el.vuFill.style.width = (100 - level * 100).toFixed(1) + '%';
    vuRaf = requestAnimationFrame(loop);
  })();
}

function stopVu(): void {
  if (vuRaf) { cancelAnimationFrame(vuRaf); vuRaf = 0; }
  if (vuCtx) { void vuCtx.close(); vuCtx = null; }
  vuAnalyser = null;
  el.vu.classList.remove('on');
  el.vuFill.style.width = '100%';
}
