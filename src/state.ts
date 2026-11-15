// Shared application state (the mutable model).
//
// Kept in a single object on purpose: ES module bindings are read-only for
// importers, so cross-module state is carried here rather than in scattered
// `let` variables. Domain logic stays out of this file.

import type { Span } from './domain/timeline.js';

export type Phase = 'idle' | 'starting' | 'live' | 'countdown' | 'recording' | 'review' | 'encoding';

// A rectangular crop, normalised to 0..1 of the capture.
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// One recording. A session is a list of them, reviewed as one joined clip.
export interface Part {
  blob: Blob;
  duration: number;   // seconds of media
}

export interface AppState {
  phase: Phase;

  stream: MediaStream | null;   // from getDisplayMedia
  rec: MediaRecorder | null;    // live recording
  chunks: Blob[];               // blobs of the recording in progress
  parts: Part[];                // the recordings made so far, in order

  duration: number;             // seconds of the whole joined clip
  trimStart: number;            // 0..1
  trimEnd: number;              // 0..1

  marks: number[];              // 0..1, up to two pending marks bounding the region to cut
  cuts: Span[];                 // 0..1, regions removed from the clip (skipped on play + export)
  // Trimming, in short: trimStart/trimEnd above are what is KEPT; `cuts` are the
  // extra regions DROPPED inside it, and `marks` is the half-made selection
  // (one mark placed, or two bounding a region to drop). See domain/timeline.ts.

  timerIv: number | null;       // record-clock interval id
  startAt: number | null;       // recording start timestamp
  rafId: number | null;         // mirror render loop id
  mirroring: boolean;
  playing: boolean;             // clip playback in progress
  playRaf: number | null;       // playback render loop id

  region: Rect;                 // crop region to record (whole source by default)
  cropRaf: number | null;       // crop render loop id while recording

  webcamStream: MediaStream | null;   // webcam capture (video only)
  webcamOn: boolean;            // webcam overlay shown/baked into the recording

  micStream: MediaStream | null;      // microphone capture (audio only)
  micOn: boolean;               // microphone mixed into the recording

  captureW: number;
  captureH: number;

  // Export audio passthrough — the review clip's soundtrack is fed into the
  // export recorder so trimmed WebM exports keep their audio.
  recAudio: boolean;            // did the last recording capture an audio track?
  audioCtx: AudioContext | null;
  audioGain: GainNode | null;           // the element's sound, for fades at joins
  audioDest: MediaStreamAudioDestinationNode | null;
}

export const app: AppState = {
  phase: 'idle',

  stream: null,
  rec: null,
  chunks: [],
  parts: [],

  duration: 0,
  trimStart: 0,
  trimEnd: 1,

  marks: [],
  cuts: [],

  timerIv: null,
  startAt: null,
  rafId: null,
  mirroring: false,
  playing: false,
  playRaf: null,

  region: { x: 0, y: 0, w: 1, h: 1 },
  cropRaf: null,

  webcamStream: null,
  webcamOn: false,

  micStream: null,
  micOn: false,

  captureW: 1280,
  captureH: 720,

  recAudio: false,
  audioCtx: null,
  audioGain: null,
  audioDest: null,
};

export function setPhase(phase: Phase): void {
  app.phase = phase;
  phaseWatchers.forEach(fn => fn(phase));
}

// Views that must follow the phase (which buttons are available in which state)
// subscribe here instead of writing the same condition at every call site.
const phaseWatchers: Array<(phase: Phase) => void> = [];

export function onPhaseChange(fn: (phase: Phase) => void): void {
  phaseWatchers.push(fn);
}
