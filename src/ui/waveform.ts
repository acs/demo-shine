// The audio track shown under the video thumbnails: a waveform of the recorded
// clip, visible only when the recording has audio. The part outside the trimmed
// range is dimmed, so it tracks the IN/OUT handles.

import { app } from '../state.js';
import { el } from './dom.js';

const BUCKETS = 600;          // horizontal resolution of the waveform
let peaks: Float32Array | null = null;
let span = 1;                 // fraction of the clip the decoded audio covers

export function clearWaveform(): void {
  peaks = null;
  el.waveform.style.display = 'none';
  el.waveform.getContext('2d')?.clearRect(0, 0, el.waveform.width, el.waveform.height);
}

export async function buildWaveform(blob: Blob | null): Promise<void> {
  if (!blob || !app.recAudio) { clearWaveform(); return; }
  try {
    const buffer = await blob.arrayBuffer();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const audio = await ctx.decodeAudioData(buffer);
    void ctx.close();
    if (!audio.duration) { clearWaveform(); return; }
    // Decoded audio is usually a touch shorter than the wall-clock clip.
    span = app.duration > 0 ? Math.min(audio.duration / app.duration, 1) : 1;
    peaks = computePeaks(audio, BUCKETS);
    el.waveform.style.display = '';
    drawWaveform();
  } catch (err) {
    console.warn('DemoShine: could not decode audio for the waveform —', err);
    clearWaveform();
  }
}

export function drawWaveform(): void {
  const cv = el.waveform;
  if (!peaks || cv.style.display === 'none') return;
  const ctx = cv.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth || 300;
  const h = cv.clientHeight || 34;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const light = document.documentElement.dataset.theme === 'light';
  const wave  = light ? 'rgba(59,127,255,0.55)'  : 'rgba(96,148,255,0.7)';
  const shade = light ? 'rgba(255,255,255,0.6)'  : 'rgba(6,7,16,0.6)';

  // Waveform bars, centred vertically.
  const mid = h / 2;
  const bw  = (w * span) / peaks.length;
  ctx.fillStyle = wave;
  for (let i = 0; i < peaks.length; i++) {
    const barH = Math.max(1, peaks[i] * (h - 4));
    ctx.fillRect(i * bw, mid - barH / 2, Math.max(bw * 0.7, 0.6), barH);
  }

  // Dim everything outside the trimmed region.
  const x0 = app.trimStart * w;
  const x1 = app.trimEnd * w;
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, x0, h);
  ctx.fillRect(x1, 0, w - x1, h);
}

function computePeaks(audio: AudioBuffer, buckets: number): Float32Array {
  const out = new Float32Array(buckets);
  const n = audio.length;
  const step = n / buckets;
  for (let i = 0; i < buckets; i++) {
    const start = Math.floor(i * step);
    const end = Math.min(Math.floor((i + 1) * step), n);
    let max = 0;
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const ch = audio.getChannelData(c);
      for (let j = start; j < end; j++) {
        const v = Math.abs(ch[j]);
        if (v > max) max = v;
      }
    }
    out[i] = max;
  }
  return out;
}
