// The timeline while a take is being recorded.
//
// Pressing Record shows the timeline straight away and fills it in as the take
// goes: the cells span the clip plus a little room ahead of the recording, so
// they compress as the take grows; cells over time already recorded show the
// picture that was on screen then, and the rest are left empty. The waveform
// grows with the sound being recorded.
//
// Nothing is decoded and nothing is read back from the recording itself — a
// half-written WebM cannot be decoded or seeked. The frames are the preview's
// own picture of the screen (the same crop and webcam the recorder is given) and
// the levels are sampled from the stream being recorded, through the same gains,
// so what is shown is what is going in. On stop the review rebuilds all of it
// from the file, exactly.

import { app } from '../state.js';
import { clock, el } from './dom.js';
import { estimateWebmText } from './size-estimate.js';
import { drawWebcamOverlay } from './webcam.js';
import { keptLengthNow, keptOf } from './clip.js';
import { currentPeaks } from './waveform.js';

const CELLS     = 22;     // the same strip the review builds
const CELL_W    = 80;
const CELL_H    = 45;
const SAMPLE_MS = 80;     // how often the audio is read
const DRAW_MS   = 250;    // how often the strip and the waveform are repainted
const PER_CELL  = 2;      // frames kept per cell, so a relayout has one to pick
const MIN_SPAN  = 20;     // seconds of room the strip assumes a take will need
const SLACK     = 1.25;   // ...and how much it leaves ahead of the recording head

let tick = 0;
let sources: HTMLCanvasElement[] = [];      // what the review strip was showing
let frames: { t: number; c: HTMLCanvasElement }[] = [];   // the take, as it goes
let lastCapture = -1;
let prevKept = 0;                           // timeline length of the clip before this take
let echo: Float32Array | null = null;       // the clip's own waveform, carried over
let samples: number[] = [];                 // levels heard so far in this take
let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let buf = new Uint8Array(0);                // the analyser's, once it starts
let lastDraw = 0;

export function startLiveTimeline(recStream: MediaStream | null): void {
  stopLiveTimeline();
  prevKept = keptLengthNow();
  echo = currentPeaks();
  sources = copyStrip();
  frames = [];
  lastCapture = -1;
  samples = [];
  startMeter(recStream);
  buildStrip();
  el.timeline.classList.add('on', 'recording');
  el.tlLabel.textContent = 'Timeline';
  el.tLive.classList.add('on');
  el.tLiveTime.textContent = '00:00';
  el.tCut.textContent = '';
  el.waveform.style.display = 'none';
  lastDraw = 0;
  tick = window.setInterval(onTick, SAMPLE_MS);
  onTick();
}

export function stopLiveTimeline(): void {
  if (tick) { clearInterval(tick); tick = 0; }
  if (audioCtx) { void audioCtx.close(); audioCtx = null; }
  analyser = null;
  buf = new Uint8Array(0);
  el.timeline.classList.remove('recording');
  el.tlLabel.textContent = 'Timeline · Trim';
  el.tLive.classList.remove('on');
  el.waveform.style.display = 'none';
}

// ── the tick ─────────────────────────────────────────────────────────────────

function onTick(): void {
  if (app.phase !== 'recording') { stopLiveTimeline(); return; }

  readAudio();
  const elapsed = elapsedSeconds();
  const head = prevKept + elapsed;
  // How much of the clip the cells are spread over: what has been recorded plus
  // room for the take to run on, so the strip fills up rather than jumping.
  const span = head + Math.max(MIN_SPAN, elapsed * SLACK);
  const step = span / CELLS / PER_CELL;

  if (elapsed - lastCapture >= step) { lastCapture = elapsed; frames.push({ t: head, c: grab() }); }

  if (Date.now() - lastDraw < DRAW_MS) return;
  lastDraw = Date.now();
  paintStrip(span, head);
  paintWave(span);
  el.rFill.style.left = '0%';
  el.rFill.style.width = ((head / span) * 100).toFixed(2) + '%';
  el.playhead.style.left = ((head / span) * 100).toFixed(2) + '%';
  el.tLiveTime.textContent = clock(elapsed);
  el.tSize.textContent = estimateWebmText(head);
}

function elapsedSeconds(): number {
  return Math.max(0, (Date.now() - (app.startAt ?? Date.now())) / 1000);
}

// The picture going into the recording right now: the share, cropped to the
// region, with the webcam bubble on it — what the recorder is being fed.
function grab(): HTMLCanvasElement {
  const c = blank();
  const ctx = c.getContext('2d');
  if (!ctx || el.sv.readyState < 2) return c;
  const r = app.region;
  const sx = Math.round(r.x * app.captureW), sy = Math.round(r.y * app.captureH);
  const sw = Math.max(1, Math.round(r.w * app.captureW)), sh = Math.max(1, Math.round(r.h * app.captureH));
  try {
    ctx.drawImage(el.sv, sx, sy, sw, sh, 0, 0, CELL_W, CELL_H);
    drawWebcamOverlay(ctx, 0, 0, CELL_W, CELL_H);
  } catch { /* a frame that is not ready — the next tick will have it */ }
  return c;
}

// ── painting ─────────────────────────────────────────────────────────────────

function paintStrip(span: number, head: number): void {
  for (let i = 0; i < CELLS; i++) {
    const canvas = cellCanvas(i);
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) continue;
    ctx.clearRect(0, 0, CELL_W, CELL_H);

    // the middle of the time this cell stands for
    const mid = (((i + 0.5) / CELLS) * span);
    if (mid > head) continue;                        // still to come
    const frame = mid < prevKept ? sourceNear(mid) : takeNear(mid);
    if (frame) ctx.drawImage(frame, 0, 0, CELL_W, CELL_H);
  }
}

// The clip's own waveform before the recording head, then the sound of the take
// as it is heard — both laid out over the same span, so they compress together.
function paintWave(span: number): void {
  const cv = el.waveform;
  if (!echo && !samples.length) { cv.style.display = 'none'; return; }
  cv.style.display = '';
  const ctx = cv.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth || 300, h = cv.clientHeight || 34;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const light = document.documentElement.dataset.theme === 'light';
  ctx.fillStyle = light ? 'rgba(59,127,255,0.55)' : 'rgba(96,148,255,0.7)';
  const mid = h / 2;
  const bar = (peak: number, when: number, bw: number) => {
    const barH = Math.max(1, peak * (h - 4));
    ctx.fillRect((when / span) * w, mid - barH / 2, bw, barH);
  };

  if (echo && echo.length) {
    // every bar of the clip so far, over the recording's own time
    const gone = app.clip.cuts.scaled(app.clip.total());
    const step = app.clip.total() / echo.length;
    const bw = Math.max(0.7, (w / span) * step);
    for (let i = 0; i < echo.length; i++) {
      const at = (i + 0.5) * step;
      if (gone.contains(at)) continue;                   // trimmed away: not in the clip
      bar(echo[i], keptOf(at), bw);
    }
  }

  const bw = Math.max(1, (w * SAMPLE_MS) / 1000 / span);
  for (let k = 0; k < samples.length; k++) {
    bar(samples[k], prevKept + (k * SAMPLE_MS) / 1000, bw);   // when it was heard
  }
}

// ── the pieces behind it ─────────────────────────────────────────────────────

function blank(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = CELL_W; c.height = CELL_H;
  return c;
}

// Keep what the review strip was showing, to draw the cells over the clip.
function copyStrip(): HTMLCanvasElement[] {
  return Array.from(el.thumbs.children).map(frame => {
    const c = blank();
    const src = frame.querySelector('canvas');
    const ctx = c.getContext('2d');
    if (src && ctx) ctx.drawImage(src, 0, 0, CELL_W, CELL_H);
    return c;
  });
}

// The nearest saved frame to a time, in either half of the clip.
function nearest(list: { t: number; c: HTMLCanvasElement }[], time: number): HTMLCanvasElement | null {
  let best: HTMLCanvasElement | null = null, bestGap = Infinity;
  for (const f of list) {
    const gap = Math.abs(f.t - time);
    if (gap < bestGap) { bestGap = gap; best = f.c; }
  }
  return best;
}

function sourceNear(time: number): HTMLCanvasElement | null {
  if (!sources.length || prevKept <= 0) return null;
  const per = prevKept / sources.length;
  const list = sources.map((c, i) => ({ t: (i + 0.5) * per, c }));
  return nearest(list, time);
}

function takeNear(time: number): HTMLCanvasElement | null {
  return frames.length ? nearest(frames, time) : null;
}

function buildStrip(): void {
  if (el.thumbs.children.length === CELLS && el.thumbs.querySelector('canvas')) return;
  el.thumbs.replaceChildren();
  for (let i = 0; i < CELLS; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'thumb-frame';
    wrap.appendChild(blank());
    el.thumbs.appendChild(wrap);
  }
}

function cellCanvas(i: number): HTMLCanvasElement | null {
  const frame = el.thumbs.children[i];
  return frame ? frame.querySelector('canvas') : null;
}

// Levels straight off the stream being recorded, so they carry the same mic
// boost and system trim the recorder applies.
function startMeter(stream: MediaStream | null): void {
  const track = stream?.getAudioTracks()[0];
  if (!track) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try {
    audioCtx = new Ctx();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    audioCtx.createMediaStreamSource(new MediaStream([track])).connect(analyser);
    buf = new Uint8Array(analyser.fftSize);
    void audioCtx.resume();
  } catch {
    audioCtx = null; analyser = null; buf = new Uint8Array(0);
  }
}

function readAudio(): void {
  if (!analyser || !buf.length) return;
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
  samples.push(Math.min(1, Math.sqrt(sum / buf.length) * 3));
}
