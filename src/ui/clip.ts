// The joined clip: the takes of a session, played as one timeline.
//
// Every press of Record produces a take. They are played in order in the same
// <video>, so that everything else in the app — the playhead, the trim handles,
// the removed regions, the thumbnails, the export — can go on thinking in terms
// of a single clip of `app.clip.total()` seconds. This module is the only place
// that knows where a time in that clip falls: which take holds it, and where in
// that take.
//
// The takes are not glued into one file: each MediaRecorder recording is its own
// WebM starting at timestamp 0, and joining them without re-muxing is not
// something a browser will do. Playing them one after another gives the review
// the same timeline, and the export — which encodes them offline — produces a
// single file from the whole thing anyway.

import { app } from '../state.js';
import { el } from './dom.js';
import { drawFrame, seekTo } from './preview.js';

let loaded = -1;                 // index of the take currently in the video

export function totalDuration(): number {
  return app.clip.takes.totalDuration();
}

// ── the timeline the user sees ───────────────────────────────────────────────
//
// Approved trims leave the timeline and what is left closes up, so the timeline
// shows what the export will hold. Everything the user sees and points at goes
// through these; the recording itself is still addressed in its own time.

export function keptLengthNow(): number {
  return app.clip.keptLength();
}

// A time in the recording, as the timeline shows it.
export function keptOf(source: number): number {
  return app.clip.timeline().keptOf(source);
}

// A time on the timeline, as the recording holds it.
export function sourceOf(kept: number): number {
  return app.clip.timeline().sourceOf(kept);
}

// The time on the joined clip, where the video currently sits.
export function clipTime(): number {
  return app.clip.takes.startOf(loaded) + el.rv.currentTime;
}

// Bring the video to a time on the joined clip, loading the take that holds it.
export function clipSeek(time: number): Promise<void> {
  if (app.clip.takes.isEmpty()) return seekTo(el.rv, Math.max(0, time));
  const index = app.clip.takes.indexAt(time);
  const local = Math.max(0, time - app.clip.takes.startOf(index));
  if (index === loaded) return seekTo(el.rv, local);
  return loadTake(index).then(() => seekTo(el.rv, local));
}

// Bring the video to a time and paint that frame on the preview.
export function clipSeekAndDraw(time: number): Promise<void> {
  return clipSeek(time).then(() => drawFrame(el.rv));
}

// Load a take from the start (a review opens on one, and the export walks them).
export function clipLoad(index: number): Promise<void> {
  return loadTake(index);
}

// Move to the next take, keeping the video playing. False when there is none.
export async function clipNext(): Promise<boolean> {
  if (loaded < 0 || loaded + 1 >= app.clip.takes.count()) return false;
  const wasPlaying = app.playing;
  await loadTake(loaded + 1);
  if (wasPlaying) await el.rv.play().catch(() => {});
  return true;
}

// How much of the take in hand is left to play.
export function takeLeft(): number {
  const take = app.clip.takes.at(loaded);
  return take ? Math.max(0, take.duration - el.rv.currentTime) : 0;
}

// Is there another take after the one in hand? A join is only a join if there
// is something on the other side of it.
export function hasNextTake(): boolean {
  return loaded >= 0 && loaded + 1 < app.clip.takes.count();
}

// Is the video sitting at the end of the take it holds? Only the end of a take
// that has another one after it matters — the last one just stops.
export function takeEnded(): boolean {
  if (el.rv.ended) return true;
  const take = app.clip.takes.at(loaded);
  return !!take && hasNextTake() && el.rv.currentTime >= take.duration - 0.05;
}

// The player's own book-keeping, and nothing more: TakeRepository owns the
// takes and their URLs, so dropping a session no longer goes through here.
export function forgetLoaded(): void {
  loaded = -1;
}

function loadTake(index: number): Promise<void> {
  const take = app.clip.takes.at(index);
  if (!take) return Promise.resolve();
  loaded = index;
  el.rv.src = take.url;      // made once, by the repository, revoked with the session
  el.rv.load();
  return new Promise(resolve => {
    el.rv.addEventListener('loadeddata', () => resolve(), { once: true });
    setTimeout(resolve, 3000);   // a take that will not decode must not wedge the review
  });
}
