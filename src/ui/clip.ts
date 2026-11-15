// The joined clip: the recordings made in a session, played as one timeline.
//
// Every press of Record produces a "part". They are played in order in the same
// <video>, so that everything else in the app — the playhead, the trim handles,
// the removed regions, the thumbnails, the export — can go on thinking in terms
// of a single clip of `app.duration` seconds. This module is the only place that
// knows where a time in that clip falls: which part holds it, and where in that
// part.
//
// The parts are not glued into one file: each MediaRecorder recording is its own
// WebM starting at timestamp 0, and joining them without re-muxing is not
// something a browser will do. Playing them one after another gives the review
// the same timeline, and the export — which re-encodes in real time — produces a
// single file from the whole thing anyway.

import { app } from '../state.js';
import { el } from './dom.js';
import { partAt, partStart, keptLength, keptTime, sourceTime, type Span } from '../domain/timeline.js';
import { drawFrame, seekTo } from './preview.js';

// Object URLs for the parts, created on first use and released with the session.
let urls: string[] = [];
let loaded = -1;                 // index of the part currently in the video

export function totalDuration(): number {
  return partStart(app.parts, app.parts.length);
}

// ── the timeline the user sees ───────────────────────────────────────────────
//
// Approved trims leave the timeline and what is left closes up, so the timeline
// shows what the export will hold. Everything the user sees and points at goes
// through these; the recording itself is still addressed in its own time.

function cutsSeconds(): Span[] {
  const d = app.duration;
  return app.cuts.map(c => ({ s: c.s * d, e: c.e * d }));
}

export function keptLengthNow(): number {
  return keptLength(cutsSeconds(), 0, app.duration);
}

// A time in the recording, as the timeline shows it.
export function keptOf(source: number): number {
  return keptTime(cutsSeconds(), source);
}

// A time on the timeline, as the recording holds it.
export function sourceOf(kept: number): number {
  return sourceTime(cutsSeconds(), kept);
}

// The time on the joined clip, where the video currently sits.
export function clipTime(): number {
  return partStart(app.parts, loaded) + el.rv.currentTime;
}

// Bring the video to a time on the joined clip, loading the part that holds it.
export function clipSeek(time: number): Promise<void> {
  if (!app.parts.length) return seekTo(el.rv, Math.max(0, time));
  const index = partAt(app.parts, time);
  const local = Math.max(0, time - partStart(app.parts, index));
  if (index === loaded) return seekTo(el.rv, local);
  return loadPart(index).then(() => seekTo(el.rv, local));
}

// Bring the video to a time and paint that frame on the preview.
export function clipSeekAndDraw(time: number): Promise<void> {
  return clipSeek(time).then(() => drawFrame(el.rv));
}

// Load a part from the start (a review opens on one, and the export walks them).
export function clipLoad(index: number): Promise<void> {
  return loadPart(index);
}

// Move to the next part, keeping the video playing. False when there is none.
export async function clipNext(): Promise<boolean> {
  if (loaded < 0 || loaded + 1 >= app.parts.length) return false;
  const wasPlaying = app.playing;
  await loadPart(loaded + 1);
  if (wasPlaying) await el.rv.play().catch(() => {});
  return true;
}

// How much of the recording in hand is left to play.
export function partLeft(): number {
  const part = app.parts[loaded];
  return part ? Math.max(0, part.duration - el.rv.currentTime) : 0;
}

// Is there another take after the one in hand? A join is only a join if there
// is something on the other side of it.
export function hasNextPart(): boolean {
  return loaded >= 0 && loaded + 1 < app.parts.length;
}

// Is the video sitting at the end of the part it holds? Only the end of a part
// that has another one after it matters — the last one just stops.
export function partEnded(): boolean {
  if (el.rv.ended) return true;
  const part = app.parts[loaded];
  return !!part && hasNextPart() && el.rv.currentTime >= part.duration - 0.05;
}

// Drop the part URLs: the session's recordings are gone.
export function releaseParts(): void {
  urls.forEach(u => URL.revokeObjectURL(u));
  urls = [];
  loaded = -1;
}

function loadPart(index: number): Promise<void> {
  const part = app.parts[index];
  if (!part) return Promise.resolve();
  if (!urls[index]) urls[index] = URL.createObjectURL(part.blob);
  loaded = index;
  el.rv.src = urls[index];
  el.rv.load();
  return new Promise(resolve => {
    el.rv.addEventListener('loadeddata', () => resolve(), { once: true });
    setTimeout(resolve, 3000);   // a part that will not decode must not wedge the review
  });
}
