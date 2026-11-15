// The audio track shown under the video thumbnails: a waveform of the recorded
// clip, visible only when the recording has audio. It is drawn in timeline time,
// so a trimmed-away stretch takes up no width and what is left closes up over
// it, and the part outside the IN/OUT range is dimmed.

import { app, type Part } from '../state.js';
import { el } from './dom.js';
import { spanAt } from '../domain/timeline.js';
import { keptLengthNow, keptOf } from './clip.js';

const BUCKETS = 600;          // horizontal resolution of the waveform
let peaks: Float32Array | null = null;

export function clearWaveform(): void {
  peaks = null;
  el.waveform.style.display = 'none';
  el.waveform.getContext('2d')?.clearRect(0, 0, el.waveform.width, el.waveform.height);
}

export async function buildWaveform(parts: Part[]): Promise<void> {
  if (!parts.length || !app.recAudio) { clearWaveform(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  try {
    // One recording per press of Record: decode each and give it as many bars as
    // its share of the sound, so the strip lines up with the whole joined clip.
    const decoded: AudioBuffer[] = [];
    for (const part of parts) decoded.push(await ctx.decodeAudioData(await part.blob.arrayBuffer()));
    const audible = decoded.reduce((n, audio) => n + audio.duration, 0);
    if (!audible) { clearWaveform(); return; }

    const out: number[] = [];
    for (const audio of decoded) {
      const bars = Math.max(1, Math.round(BUCKETS * (audio.duration / audible)));
      out.push(...computePeaks(audio, bars));
    }
    peaks = Float32Array.from(out);
    el.waveform.style.display = '';
    drawWaveform();
  } catch (err) {
    console.warn('DemoShine: could not decode audio for the waveform —', err);
    clearWaveform();
  } finally {
    void ctx.close();
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

  // The bars are drawn in timeline time: a trimmed-away stretch has no width on
  // screen, so its bars are left out and the rest closes up over it.
  const kept = keptLengthNow();
  if (!(kept > 0)) return;
  const cuts = app.cuts.map(c => ({ s: c.s * app.duration, e: c.e * app.duration }));
  const step = app.duration / peaks.length;
  const bw = Math.max(0.7, (w / kept) * step);

  const mid = h / 2;
  ctx.fillStyle = wave;
  for (let i = 0; i < peaks.length; i++) {
    const at = (i + 0.5) * step;                       // when that bar was heard
    if (spanAt(cuts, at) >= 0) continue;               // not in the clip any more
    const barH = Math.max(1, peaks[i] * (h - 4));
    ctx.fillRect((keptOf(at) / kept) * w - bw / 2, mid - barH / 2, bw, barH);
  }

  // Dim everything outside the kept range.
  const x0 = (keptOf(app.trimStart * app.duration) / kept) * w;
  const x1 = (keptOf(app.trimEnd * app.duration) / kept) * w;
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, Math.max(0, x0), h);
  ctx.fillRect(Math.min(w, x1), 0, Math.max(0, w - x1), h);
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
