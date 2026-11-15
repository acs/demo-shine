// Shared application state (the mutable model).
//
// Kept in a single object on purpose: ES module bindings are read-only for
// importers, so cross-module state is carried here rather than in scattered
// `let` variables. Domain logic stays out of this file.

import { Clip } from './domain/clip/Clip.js';
import { InMemoryTakeRepository } from './infra/takes.js';

export type Phase = 'idle' | 'starting' | 'live' | 'countdown' | 'recording' | 'review' | 'encoding';

// A rectangular crop, normalised to 0..1 of the capture.
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// One recording. A session is a list of them, reviewed as one joined clip.
export interface AppState {
  phase: Phase;

  stream: MediaStream | null;   // from getDisplayMedia
  rec: MediaRecorder | null;    // live recording
  chunks: Blob[];               // blobs of the recording in progress
  clip: Clip;                   // the takes, the keep range, and what was trimmed away —
                                // everything else asks this object what the clip is

  marks: number[];              // 0..1, up to two pending marks bounding the section to cut —
                                // the half-made selection, which the view owns

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
}

export const app: AppState = {
  phase: 'idle',

  stream: null,
  rec: null,
  chunks: [],
  clip: Clip.empty(new InMemoryTakeRepository()),

  marks: [],

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
