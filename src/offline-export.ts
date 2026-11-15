// The export, encoded offline.
//
// The recording is made in real time — getDisplayMedia hands over a live stream
// and MediaRecorder is the only thing that can encode it as it happens — but the
// export no longer has to be. Nothing plays here: each take is read with
// Mediabunny, decoded in order by VideoDecoder, and drawn on a canvas, which is
// where the trimmed stretches disappear, the sound is faded and the picture
// dissolves; VideoEncoder encodes those frames, AudioEncoder the sound that an
// OfflineAudioContext rendered off the clock; and webm-muxer writes the
// container, including the Duration and Cues that MediaRecorder leaves out.
//
// Measured on a 6 s 1280x720 take (see POC-offline-export.md): 11.6x real time,
// against 1x for the real-time export and 1.8x for an attempt that seeked to each
// frame. It runs with the tab in the background, and the file it writes seeks.
//
// What this deliberately does not do: fall back to anything. If WebCodecs is not
// there, or a take cannot be read, it throws — src/exporter.ts owns the decision
// to export the slow way instead.

import { ArrayBufferTarget, Muxer } from 'webm-muxer';
import { BufferSource, Input, VideoSampleSink, WEBM } from 'mediabunny';
import { app } from './state.js';
import { ctx as preview, el } from './ui/dom.js';
import { cutEndAt, cutsInSeconds, keptTime, partAt, partStart, type Span } from './domain/timeline.js';
import { clearFrame, dissolveAlpha, heldCanvas, holdFrom } from './ui/dissolve.js';
import { FADE_S } from './ui/fade.js';

const BITRATE        = 4_000_000;   // video, bits per second
const KEYFRAME_EVERY = 2;           // seconds between keyframes, so the file seeks
const SAMPLE_RATE    = 48_000;
const AUDIO_BITRATE  = 128_000;
const AUDIO_BLOCK    = 1024;        // samples per AudioData submitted
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

async function pickVideoCodec(width: number, height: number): Promise<{ encoder: string; muxer: string } | null> {
  const wanted = [
    { encoder: 'vp09.00.10.08', muxer: 'V_VP9' },   // VP9, what the export prefers
    { encoder: 'vp8',           muxer: 'V_VP8' },   // the fallback codec
  ];
  for (const c of wanted) {
    try {
      const support = await VideoEncoder.isConfigSupported({ codec: c.encoder, width, height, bitrate: BITRATE });
      if (support.supported) return c;
    } catch { /* an unknown codec string is simply not supported */ }
  }
  return null;
}

// The sound of the kept range, rendered off the clock: each take is decoded, its
// kept stretches placed end to end, and the same fade put either side of a join
// that playback has. Null when the clip has no sound.
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
  const failure: { error: Error | null } = { error: null };

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: codec.muxer, width: ec.width, height: ec.height },
    ...(audio ? { audio: { codec: 'A_OPUS', numberOfChannels: 2, sampleRate: SAMPLE_RATE } } : {}),
    firstTimestampBehavior: 'offset',
  });
  const video = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: err => { failure.error = err as Error; },
  });
  video.configure({ codec: codec.encoder, width: ec.width, height: ec.height, bitrate: BITRATE });

  const sound = audio ? new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: err => { failure.error = err as Error; },
  }) : null;
  sound?.configure({ codec: 'opus', sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: AUDIO_BITRATE });

  // The sound is submitted in step with the picture, so the muxer sees the two
  // tracks in order rather than all of one and then all of the other.
  let sample = 0;
  const pumpAudio = (upTo: number): void => {
    if (!audio || !sound) return;
    while (sample / SAMPLE_RATE <= upTo && sample < audio.length && (sound.encodeQueueSize ?? 0) < 32) {
      const frames = Math.min(AUDIO_BLOCK, audio.length - sample);
      const data = new Float32Array(frames * 2);
      for (let ch = 0; ch < 2; ch++) {
        data.set(audio.getChannelData(ch).subarray(sample, sample + frames), ch * frames);
      }
      const chunk = new AudioData({
        format: 'f32-planar',
        sampleRate: SAMPLE_RATE,
        numberOfFrames: frames,
        numberOfChannels: 2,
        timestamp: Math.round((sample / SAMPLE_RATE) * 1e6),
        data,
      });
      sound.encode(chunk);
      chunk.close();
      sample += frames;
    }
  };

  const base = keptTime(cuts, s);      // where the export starts on the kept timeline
  const keyFrameUs = KEYFRAME_EVERY * 1e6;
  let frames = 0;
  let lastEnd = -1;

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
            if (failure.error) throw failure.error;

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

            const ts = Math.max(Math.round(at * 1e6), lastEnd);
            const out = new VideoFrame(ec, { timestamp: ts, duration: Math.round(frame.duration * 1e6) });
            video.encode(out, { keyFrame: Math.floor(ts / keyFrameUs) !== Math.floor(lastEnd / keyFrameUs) });
            out.close();
            lastEnd = ts;
            frames++;
            pumpAudio(at);
            if (frames % REPORT_EVERY === 0) onProgress?.(source);
            // Back-pressure: do not let the encoders queue the whole clip in memory.
            while ((video.encodeQueueSize ?? 0) > 8) await new Promise(r => setTimeout(r, 0));
          } finally {
            frame.close();
          }
        }
      } finally {
        input.dispose();
      }
    }
    if (!frames) throw new Error('no frames came back from the takes');

    pumpAudio(total);
    await video.flush();
    await sound?.flush();
    if (failure.error) throw failure.error;
    muxer.finalize();
  } finally {
    clearFrame();          // a dissolve must not outlive the export
  }

  const blob = new Blob([muxer.target.buffer], { type: 'video/webm' });
  const ms = performance.now() - started;
  return { blob, stats: { clip: total, ms, realtime: (total * 1000) / ms, frames, bytes: blob.size } };
}
