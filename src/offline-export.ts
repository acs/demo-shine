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
// What to write is not decided here. It arrives as an `ExportPlan` — the kept
// stretches, where each lands, where the joins are — built in
// src/application/export-clip.ts, which is where that thinking belongs and where
// it can be tested. This file keeps the browser.
//
// Measured on a 6 s 1280x720 take (see POC-offline-export.md): 11.6x real time,
// against 1x for the real-time export and 1.8x for an attempt that seeked to each
// frame. It runs with the tab in the background, and the file it writes seeks.
//
// What this deliberately does not do: fall back to anything. If WebCodecs is not
// there, or a take cannot be read, it throws — src/exporter.ts owns the decision
// to refuse and say so.

import {
  AudioBufferSource, BufferSource, BufferTarget, CanvasSource, Input, Output, Quality,
  VideoSampleSink, WEBM, WebMOutputFormat,
} from 'mediabunny';
import type { ExportPlan } from './domain/clip/ExportPlan.js';
import { ctx as preview, el } from './ui/dom.js';
import { clearFrame, dissolveAlpha, heldCanvas, holdFrom } from './ui/dissolve.js';

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
async function renderAudio(plan: ExportPlan): Promise<AudioBuffer | null> {
  const pieces = plan.pieces;
  if (!plan.audio || !pieces.length) return null;
  const takes = plan.takes;
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(plan.total * SAMPLE_RATE)), SAMPLE_RATE);
  const decoded = new Map<number, AudioBuffer>();
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    let buffer = decoded.get(piece.takeIndex);
    if (!buffer) {
      buffer = await ctx.decodeAudioData(await takes[piece.takeIndex].blob.arrayBuffer());
      decoded.set(piece.takeIndex, buffer);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 1;
    const length = piece.to - piece.from;
    // Down as this take runs out, up as the next begins — only at a real join.
    if (plan.joinsPrev(i)) {
      gain.gain.setValueAtTime(0, piece.at);
      gain.gain.linearRampToValueAtTime(1, piece.at + Math.min(plan.fadeSeconds, length));
    }
    if (plan.joinsNext(i) && length > plan.fadeSeconds) {
      gain.gain.setValueAtTime(1, piece.at + length - plan.fadeSeconds);
      gain.gain.linearRampToValueAtTime(0, piece.at + length);
    }
    src.connect(gain).connect(ctx.destination);
    // The stretch of the take, placed where it belongs on the output timeline.
    src.start(piece.at, piece.from - plan.startOf(piece.takeIndex), length);
  }
  return ctx.startRendering();
}

export async function exportOffline(plan: ExportPlan, onProgress?: (source: number) => void): Promise<{ blob: Blob; stats: OfflineStats }> {
  const started = performance.now();
  const takes = plan.takes;
  if (!plan.pieces.length) throw new Error('nothing to export');

  const ec = document.createElement('canvas');
  ec.width = el.cv.width || 1280;
  ec.height = el.cv.height || 720;
  const ectx = ec.getContext('2d');
  if (!ectx) throw new Error('no 2D context for the export');

  const codec = await pickVideoCodec(ec.width, ec.height);
  if (!codec) throw new Error('this browser cannot encode WebM offline');
  const audio = await renderAudio(plan);

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

  let frames = 0;

  try {
    for (const step of plan.steps) {
      // Entering a take that follows another: the frame left behind is the one to
      // dissolve away from, and this is where the dissolve starts.
      if (step.joinAt !== null) holdFrom(ec);

      const input = new Input({
        source: new BufferSource(await takes[step.takeIndex].blob.arrayBuffer()),
        formats: [WEBM],   // WebM only: Mediabunny's other demuxers stay out of the bundle
      });
      try {
        const track = await input.getPrimaryVideoTrack();
        if (!track) throw new Error('a take has no video track');
        if (!(await track.canDecode())) throw new Error('a take cannot be decoded');
        const first = await input.getFirstTimestamp();
        const from = step.local.from + first;
        const to   = step.local.to + first;

        for await (const frame of new VideoSampleSink(track).samples(from, to)) {
          try {
            const source = plan.startOf(step.takeIndex) + (frame.timestamp - first);
            const at = plan.outputTimeOf(source);              // the output timeline
            if (at < -0.001 || at > plan.total + 0.001) continue;   // cut away, or outside

            // The picture's side of the join, the same blend playback draws: the
            // frame left behind at full, the new take rising over it.
            const alpha = step.joinAt === null ? null : dissolveAlpha(at - step.joinAt);
            const held = alpha === null ? null : heldCanvas();
            if (held && alpha !== null) {
              ectx.globalAlpha = 1;
              ectx.drawImage(held, 0, 0, ec.width, ec.height);
              ectx.globalAlpha = alpha;
            }
            frame.draw(ectx, 0, 0, ec.width, ec.height);
            ectx.globalAlpha = 1;
            // The preview shows what is being written: the export does not play, so
            // nothing else would move.
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
  return { blob, stats: { clip: plan.total, ms, realtime: (plan.total * 1000) / ms, frames, bytes: blob.size } };
}
