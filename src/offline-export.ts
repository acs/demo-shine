// The export, encoded offline.
//
// The recording is made in real time — getDisplayMedia hands over a live stream
// and MediaRecorder is the only thing that can encode it as it happens — but the
// export no longer has to be. Nothing plays here: each take is read with
// Mediabunny, decoded in order by VideoDecoder, and drawn on a canvas, which is
// where the trimmed stretches disappear, the sound is faded and the picture
// dissolves at a join; the canvas goes back to Mediabunny, which encodes it and
// writes the container, and the sound an OfflineAudioContext rendered off the
// clock goes the same way. One library reads and writes; the file it writes
// carries the Duration and Cues that MediaRecorder leaves out.
//
// Measured on a 6 s 1280x720 take (see POC-offline-export.md): 11.6x real time,
// against 1x for the real-time export and 1.8x for an attempt that seeked to each
// frame. It runs with the tab in the background, and the file it writes seeks.
//
// What this deliberately does not do: fall back to anything. If WebCodecs is not
// there, or a take cannot be read, it throws — src/exporter.ts owns the decision
// to export the slow way instead.

import {
  AudioBufferSource, BufferSource, BufferTarget, CanvasSource, Input, Output, Quality,
  VideoSampleSink, WEBM, WebMOutputFormat,
} from 'mediabunny';
import { app } from './state.js';
import { ctx as preview, el } from './ui/dom.js';
import { cutEndAt, cutsInSeconds, keptTime, partAt, partStart, type Span } from './domain/timeline.js';
import { clearFrame, dissolveAlpha, heldCanvas, holdFrom } from './ui/dissolve.js';
import { FADE_S } from './ui/fade.js';

const VIDEO_BITRATE  = 4_000_000;   // bits per second
const AUDIO_BITRATE  = 128_000;
const KEYFRAME_S     = 2;           // seconds between keyframes, so the file seeks
const SAMPLE_RATE    = 48_000;
const REPORT_EVERY   = 8;           // frames between progress reports

export type OfflineStats = {
  clip: number;       // seconds of clip written
  ms: number;         // how long the export took
  realtime: number;   // how many times faster than the clip that is
  frames: number;
  bytes: number;
};

// Whether this browser can encode offline at all: Chrome 94+, Firefox 130+.
export function offlineAvailable(): boolean {
  return typeof VideoEncoder === 'function' && typeof AudioEncoder === 'function';
}

// A kept stretch: a range of one take that survives the trims.
type Segment = { part: number; from: number; to: number };

// The kept stretches of [from, to], in order, with the trimmed stretches taken
// out — the same timeline the player walks, made explicit so that the picture
// and the sound cannot disagree about it.
function keptSegments(from: number, to: number, cuts: Span[]): Segment[] {
  const out: Segment[] = [];
  let t = from;
  while (t < to - 0.001) {
    const cutEnd = cutEndAt(cuts, t);
    if (cutEnd !== null) { t = Math.min(cutEnd, to); continue; }
    const index = partAt(app.parts, t);
    let end = Math.min(to, partStart(app.parts, index) + app.parts[index].duration);
    for (const c of cuts) if (c.s > t + 0.001 && c.s < end) end = c.s;
    if (end <= t + 0.001) break;
    out.push({ part: index, from: t, to: end });
    t = end;
  }
  return out;
}

// VP9, the codec the recording itself prefers, with VP8 behind it. Asked of
// WebCodecs directly rather than of Mediabunny: its codec registry is a lot of
// table for one question, and this is the one it is kept out of the bundle for.
async function pickVideoCodec(width: number, height: number): Promise<'vp9' | 'vp8' | null> {
  const wanted = [
    { codec: 'vp9' as const, probe: 'vp09.00.10.08' },
    { codec: 'vp8' as const, probe: 'vp8' },
  ];
  for (const { codec, probe } of wanted) {
    try {
      if ((await VideoEncoder.isConfigSupported({ codec: probe, width, height, bitrate: VIDEO_BITRATE })).supported) return codec;
    } catch { /* an unknown codec string: try the next */ }
  }
  return null;
}

// The sound of the kept range, rendered off the clock: each take is decoded, its
// kept stretches placed end to end, and the same fade put either side of a join
// that playback has. Null when the clip has no sound.
//
// It is handed over as one buffer, which is why the mixing happens here rather
// than in the encoder: an OfflineAudioContext is the only place a Web Audio graph
// can be rendered faster than real time.
async function renderAudio(segments: Segment[], offsets: number[], total: number): Promise<AudioBuffer | null> {
  if (!app.recAudio || !segments.length) return null;
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(total * SAMPLE_RATE)), SAMPLE_RATE);
  const decoded = new Map<number, AudioBuffer>();
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    let buffer = decoded.get(seg.part);
    if (!buffer) {
      buffer = await ctx.decodeAudioData(await app.parts[seg.part].blob.arrayBuffer());
      decoded.set(seg.part, buffer);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 1;
    const start = offsets[i];
    const length = seg.to - seg.from;
    // Down as this take runs out, up as the next begins — only at a real join.
    const joinsNext = segments[i + 1] && segments[i + 1].part !== seg.part;
    const joinsPrev = segments[i - 1] && segments[i - 1].part !== seg.part;
    if (joinsPrev) {
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(1, start + Math.min(FADE_S, length));
    }
    if (joinsNext && length > FADE_S) {
      gain.gain.setValueAtTime(1, start + length - FADE_S);
      gain.gain.linearRampToValueAtTime(0, start + length);
    }
    src.connect(gain).connect(ctx.destination);
    // The stretch of the take, placed where it belongs on the output timeline.
    src.start(start, seg.from - partStart(app.parts, seg.part), length);
  }
  return ctx.startRendering();
}

export async function exportOffline(onProgress?: (source: number) => void): Promise<{ blob: Blob; stats: OfflineStats }> {
  const started = performance.now();
  const s = app.trimStart * app.duration;
  const e = Math.min(app.trimEnd * app.duration, app.duration - 0.05);
  if (!app.parts.length || e <= s) throw new Error('nothing to export');
  const cuts = cutsInSeconds(app.cuts, app.duration);

  const segments = keptSegments(s, e, cuts);
  if (!segments.length) throw new Error('nothing to export');
  const offsets: number[] = [];
  let total = 0;
  for (const seg of segments) { offsets.push(total); total += seg.to - seg.from; }

  // Where each take first appears on the output timeline: that is where a join
  // is, and so where a dissolve has to start.
  const partFirstOffset = new Map<number, number>();
  segments.forEach((seg, i) => { if (!partFirstOffset.has(seg.part)) partFirstOffset.set(seg.part, offsets[i]); });
  const parts = [...partFirstOffset.keys()];
  if (!parts.length) throw new Error('nothing to export');

  const ec = document.createElement('canvas');
  ec.width = el.cv.width || 1280;
  ec.height = el.cv.height || 720;
  const ectx = ec.getContext('2d');
  if (!ectx) throw new Error('no 2D context for the export');

  const codec = await pickVideoCodec(ec.width, ec.height);
  if (!codec) throw new Error('this browser cannot encode WebM offline');
  const audio = await renderAudio(segments, offsets, total);

  const output = new Output({ format: new WebMOutputFormat(), target: new BufferTarget() });
  const video = new CanvasSource(ec, {
    codec,
    quality: new Quality({ bitrate: VIDEO_BITRATE }),
    keyFrameInterval: KEYFRAME_S,
  });
  output.addVideoTrack(video);
  const sound = audio ? new AudioBufferSource({ codec: 'opus', quality: new Quality({ bitrate: AUDIO_BITRATE }) }) : null;
  if (sound) output.addAudioTrack(sound);
  await output.start();

  const base = keptTime(cuts, s);      // where the export starts on the kept timeline
  let frames = 0;

  try {
    for (let p = 0; p < parts.length; p++) {
      const part = parts[p];
      // Entering a take that follows another: the frame left behind is the one to
      // dissolve away from, and this is where the dissolve starts.
      const joinAt = partFirstOffset.get(part) ?? 0;
      const followsAnother = p > 0;
      if (followsAnother) holdFrom(ec);

      const input = new Input({
        source: new BufferSource(await app.parts[part].blob.arrayBuffer()),
        formats: [WEBM],   // WebM only: Mediabunny's other demuxers stay out of the bundle
      });
      try {
        const track = await input.getPrimaryVideoTrack();
        if (!track) throw new Error('a take has no video track');
        if (!(await track.canDecode())) throw new Error('a take cannot be decoded');
        const first = await input.getFirstTimestamp();
        const from = Math.max(s, partStart(app.parts, part)) - partStart(app.parts, part) + first;
        const to   = Math.min(e, partStart(app.parts, part) + app.parts[part].duration) - partStart(app.parts, part) + first;

        for await (const frame of new VideoSampleSink(track).samples(from, to)) {
          try {
            const source = partStart(app.parts, part) + (frame.timestamp - first);
            const at = keptTime(cuts, source) - base;      // the output timeline
            if (at < -0.001 || at > total + 0.001) continue;   // trimmed away, or outside

            // The picture's side of the join, the same blend playback draws: the
            // frame left behind at full, the new take rising over it.
            const alpha = followsAnother ? dissolveAlpha(at - joinAt) : null;
            const held = alpha === null ? null : heldCanvas();
            if (held && alpha !== null) {
              ectx.globalAlpha = 1;
              ectx.drawImage(held, 0, 0, ec.width, ec.height);
              ectx.globalAlpha = alpha;
            }
            frame.draw(ectx, 0, 0, ec.width, ec.height);
            ectx.globalAlpha = 1;
            // The preview shows what is being written, as the real-time export
            // does — the export does not play, so nothing else would move.
            preview.drawImage(ec, 0, 0, el.cv.width, el.cv.height);

            // Hand the canvas over: Mediabunny encodes it and writes the frame,
            // and awaiting is how its back-pressure is respected.
            await video.add(at, frame.duration);
            frames++;
            if (frames % REPORT_EVERY === 0) onProgress?.(source);
          } finally {
            frame.close();
          }
        }
      } finally {
        input.dispose();
      }
    }
    if (!frames) throw new Error('no frames came back from the takes');

    // The sound, whole, then the file.
    if (sound && audio) await sound.add(audio);
    await output.finalize();
  } finally {
    clearFrame();          // a dissolve must not outlive the export
  }

  const buffer = output.target.buffer;
  if (!buffer) throw new Error('the encoder wrote nothing');
  const blob = new Blob([buffer], { type: 'video/webm' });
  const ms = performance.now() - started;
  return { blob, stats: { clip: total, ms, realtime: (total * 1000) / ms, frames, bytes: blob.size } };
}
