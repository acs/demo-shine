// Microphone capture with a level (VU) meter.
//
// A header toggle starts the microphone; its level is shown in a small VU meter
// next to the button. When on, the mic is mixed with the capture's system audio
// in the recording (see recorder.ts).
//
// The meter's own state — the graph it reads the level from, and the frame loop
// that draws it — is one object: it exists while the microphone is on, and `stop`
// lets all of it go. Nothing here touches the clip, so a session ending does not
// put the microphone away: that is the user's toggle, not the session's.

import { app } from '../state.js';
import { el, toast } from './dom.js';
import { setMicPresent } from './source-buttons.js';

export class Meter {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private frame = 0;

  /** Show the level of this stream, until `stop`. */
  show(stream: MediaStream): void {
    this.stop();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    const src = this.ctx.createMediaStreamSource(stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    src.connect(this.analyser);                   // not routed to speakers — no feedback
    void this.ctx.resume();

    el.vu.classList.add('on');
    const buf = new Uint8Array(this.analyser.fftSize);
    let level = 0;
    const loop = () => {
      const analyser = this.analyser;
      if (!analyser) return;
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / buf.length);
      const target = Math.min(1, rms * 3.2);        // a little gain so it reads well
      level = target > level ? target : level * 0.82; // fast attack, slow release
      el.vuFill.style.height = (level * 100).toFixed(1) + '%';   // the bar rises with the voice
      this.frame = requestAnimationFrame(loop);
    };
    loop();
  }

  /** The microphone is off: the meter goes, and the graph with it. */
  stop(): void {
    if (this.frame) { cancelAnimationFrame(this.frame); this.frame = 0; }
    if (this.ctx) { void this.ctx.close(); this.ctx = null; }
    this.analyser = null;
    el.vu.classList.remove('on');
    el.vuFill.style.height = '0%';
  }
}

export const meter = new Meter();

export function initMic(): void {
  setMicPresent(false);                         // until we know a mic exists
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
  setMicPresent(has);
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
    meter.show(stream);
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
  meter.stop();
}
