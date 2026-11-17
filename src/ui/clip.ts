// The joined clip: the takes of a session, played as one timeline.
//
// Every press of Record produces a take. They are played in order in the same
// <video>, so that everything else in the app — the playhead, the trim handles,
// the cuts, the thumbnails, the export — can go on thinking in terms
// of a single clip of `app.clip.total()` seconds. This module is the only place
// that knows where a time in that clip falls: which take holds it, and where in
// that take.
//
// The takes are not glued into one file: each MediaRecorder recording is its own
// WebM starting at timestamp 0, and joining them without re-muxing is not
// something a browser will do. Playing them one after another gives the review
// the same timeline, and the export — which encodes them offline — produces a
// single file from the whole thing anyway.
//
// The one thing here that is state is which take the element is holding, so it
// lives on the `Player` the module exports — the player, not the transport: it
// says what is in the video and moves it there, while playback.ts runs the
// playhead over it. The mappings above it hold nothing and stay functions.

import { app } from '../state.js';
import { el } from './dom.js';
import { drawFrame, seekTo } from './preview.js';

// ── the timeline the user sees ───────────────────────────────────────────────
//
// Approved trims leave the timeline and what is left closes up, so the timeline
// shows what the export will hold. Everything the user sees and points at goes
// through these; the recording itself is still addressed in its own time.

// The length the timeline is drawn over: the whole clip with the cuts taken out.
// It is **not** the keep range's length — the IN/OUT handles sit *inside* the
// timeline, and everything laid out on it (the strip, the waveform, the marks, the
// playhead) is measured against this. Dividing by the keep range instead put the
// playhead over a different moment than the picture under it.
export function keptLengthNow(): number {
  return app.clip.timeline().kept;
}

// A time in the recording, as the timeline shows it.
export function keptOf(source: number): number {
  return app.clip.timeline().keptOf(source);
}

// A time on the timeline, as the recording holds it.
export function sourceOf(kept: number): number {
  return app.clip.timeline().sourceOf(kept);
}

// ── the take in the element ──────────────────────────────────────────────────
//
// Which take the video is showing, and moving it to another: the joined clip is
// played by holding one take at a time, so this is the state of the player and
// it goes when the session does.

export class Player {
  private loaded = -1;                 // index of the take currently in the video

  // The time on the joined clip, where the video currently sits.
  time(): number {
    return app.clip.takes.startOf(this.loaded) + el.rv.currentTime;
  }

  // Bring the video to a time on the joined clip, loading the take that holds it.
  seek(time: number): Promise<void> {
    if (app.clip.takes.isEmpty()) return seekTo(el.rv, Math.max(0, time));
    const index = app.clip.takes.indexAt(time);
    const local = Math.max(0, time - app.clip.takes.startOf(index));
    if (index === this.loaded) return seekTo(el.rv, local);
    return this.loadTake(index).then(() => seekTo(el.rv, local));
  }

  // Bring the video to a time and paint that frame on the preview.
  seekAndDraw(time: number): Promise<void> {
    return this.seek(time).then(() => drawFrame(el.rv));
  }

  // Load a take from the start (a review opens on one, and the export walks them).
  load(index: number): Promise<void> {
    return this.loadTake(index);
  }

  // Move to the next take, keeping the video playing. False when there is none.
  async next(): Promise<boolean> {
    if (this.loaded < 0 || this.loaded + 1 >= app.clip.takes.count()) return false;
    const wasPlaying = app.playing;
    await this.loadTake(this.loaded + 1);
    if (wasPlaying) await el.rv.play().catch(() => {});
    return true;
  }

  // How much of the take in hand is left to play.
  takeLeft(): number {
    const take = app.clip.takes.at(this.loaded);
    return take ? Math.max(0, take.duration - el.rv.currentTime) : 0;
  }

  // Is there another take after the one in hand? A join is only a join if there
  // is something on the other side of it.
  hasNext(): boolean {
    return this.loaded >= 0 && this.loaded + 1 < app.clip.takes.count();
  }

  // Is the video sitting at the end of the take it holds? Only the end of a take
  // that has another one after it matters — the last one just stops.
  ended(): boolean {
    if (el.rv.ended) return true;
    const take = app.clip.takes.at(this.loaded);
    return !!take && this.hasNext() && el.rv.currentTime >= take.duration - 0.05;
  }

  // The player's own book-keeping, and nothing more: TakeRepository owns the
  // takes and their URLs, so dropping a session no longer goes through here.
  forget(): void {
    this.loaded = -1;
  }

  private loadTake(index: number): Promise<void> {
    const take = app.clip.takes.at(index);
    if (!take) return Promise.resolve();
    this.loaded = index;
    el.rv.src = take.url;      // made once, by the repository, revoked with the session
    el.rv.load();
    return new Promise(resolve => {
      el.rv.addEventListener('loadeddata', () => resolve(), { once: true });
      setTimeout(resolve, 3000);   // a take that will not decode must not wedge the review
    });
  }
}

export const player = new Player();
