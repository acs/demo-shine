// Shared application state (the mutable model).
//
// Kept in a single object on purpose: ES module bindings are read-only for
// importers, so cross-module state is carried here rather than in scattered
// `let` variables. Domain logic stays out of this file.
export const app = {
  phase: 'idle',          // idle | starting | recording | review | encoding
  fmt: 'webm',            // webm | gif

  stream: null,           // MediaStream from getDisplayMedia
  rec: null,              // MediaRecorder for the live recording
  chunks: [],             // recorded blobs
  blob: null,             // the assembled recording

  duration: 0,            // seconds, resolved after recording
  trimStart: 0,           // 0..1
  trimEnd: 1,             // 0..1

  timerIv: null,          // record-clock interval id
  startAt: null,          // recording start timestamp
  rafId: null,            // mirror render loop id
  mirroring: false,

  captureW: 1280,
  captureH: 720,

  // Export audio passthrough — the review clip's soundtrack is fed into the
  // export recorder so trimmed WebM exports keep their audio.
  recAudio: false,        // did the last recording capture an audio track?
  audioCtx: null,         // lazy Web Audio context, reused across exports
  audioDest: null,        // MediaStreamDestination feeding the export recorder
};

export function setPhase(phase) {
  app.phase = phase;
}
