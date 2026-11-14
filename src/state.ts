// Shared application state (the mutable model).
//
// Kept in a single object on purpose: ES module bindings are read-only for
// importers, so cross-module state is carried here rather than in scattered
// `let` variables. Domain logic stays out of this file.

export type Phase = 'idle' | 'starting' | 'recording' | 'review' | 'encoding';
export type Format = 'webm' | 'gif';

export interface AppState {
  phase: Phase;
  fmt: Format;

  stream: MediaStream | null;   // from getDisplayMedia
  rec: MediaRecorder | null;    // live recording
  chunks: Blob[];               // recorded blobs
  blob: Blob | null;            // the assembled recording

  duration: number;             // seconds, resolved after recording
  trimStart: number;            // 0..1
  trimEnd: number;              // 0..1

  timerIv: number | null;       // record-clock interval id
  startAt: number | null;       // recording start timestamp
  rafId: number | null;         // mirror render loop id
  mirroring: boolean;

  captureW: number;
  captureH: number;

  // Export audio passthrough — the review clip's soundtrack is fed into the
  // export recorder so trimmed WebM exports keep their audio.
  recAudio: boolean;            // did the last recording capture an audio track?
  audioCtx: AudioContext | null;
  audioDest: MediaStreamAudioDestinationNode | null;
}

export const app: AppState = {
  phase: 'idle',
  fmt: 'webm',

  stream: null,
  rec: null,
  chunks: [],
  blob: null,

  duration: 0,
  trimStart: 0,
  trimEnd: 1,

  timerIv: null,
  startAt: null,
  rafId: null,
  mirroring: false,

  captureW: 1280,
  captureH: 720,

  recAudio: false,
  audioCtx: null,
  audioDest: null,
};

export function setPhase(phase: Phase): void {
  app.phase = phase;
}
