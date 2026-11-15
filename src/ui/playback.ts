// Playback of the recorded clip, rendered on the preview canvas with sound and
// kept in sync with the trim handles: playback is bounded by IN/OUT, and moving
// a handle while playing re-clamps the playhead; while paused, moving a handle
// previews that handle's frame.
//
// The cuts are jumped over as they are reached, without pausing,
// so the trimmed clip plays as one continuous piece. Three pieces of state make
// that work:
//
//   askedSkip   the cut end already seeked to — each jump is asked for once, not
//               once per frame, so the browser is never re-asked mid-seek
//   scrubbing   a bar is being dragged: play even inside a cut, which is the
//               whole point of dragging one
//   seenAt/seenTime   watchdog — if the playhead really will not move, stop
//               rather than leave the transport claiming to play
//
// All of it is the playback in progress — a seek in flight, a stall being
// watched, a join the sound is already down for — so it lives on this object
// rather than in module variables. The transport belongs to the view module that
// owns it; what the session does is end its lifetime, by calling `reset`.

import { app } from '../state.js';
import { el } from './dom.js';
import { drawClipFrame } from './preview.js';
import { clampToClip } from '../util.js';
import { keptLengthNow, keptOf, player } from './clip.js';
import { FADE_S, fadeIn, fadeOut, fadeReset } from './fade.js';
import { dissolve } from './dissolve.js';

const PLAY_ICON  = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const PAUSE_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>';

const STALL_MS  = 2500;   // how long the playhead may stand still before we stop
const SEEK_MS   = 12000;  // ...but a seek gets longer: jumping a trim means seeking
const NUDGE_MS  = 600;    // ...and a seek that left the clip paused gets a moment

const clipStart = () => app.clip.trim.start * app.clip.total();
const clipEnd   = () => app.clip.trim.end * app.clip.total();

// The end of the cut the playhead sits in, in seconds, or null when
// it is not inside one. The cuts are stored as fractions of the clip.
function cutEndFor(t: number): number | null {
  if (!(app.clip.total() > 0)) return null;
  // Asked in seconds: the map holds the cuts in the recording's own time, so
  // the fraction-of-the-clip the app stores never reaches this question.
  return app.clip.timeline().endAt(t);
}

export class Playback {
  private askedSkip = 0;       // cut end already seeked to, so it is asked for once
  private seekSince = 0;       // when the seek in flight started (0 = none)
  private nudgedAt  = 0;       // when playback was last re-asked for after a seek
  private scrubbing = false;   // a bar is being dragged: play even inside a cut
  private seenAt    = 0;       // watchdog: position of the playhead at the last look
  private seenTime  = 0;       // watchdog: when that look happened
  private joinFaded = false;   // the sound is down for a join that is coming

  // While a bar is dragged the clip is played from wherever it is, including the
  // inside of a cut — otherwise there would be nothing to hear.
  setScrubbing(on: boolean): void {
    this.scrubbing = on;
    this.askedSkip = 0;
    this.seenAt = player.time();
    this.seenTime = Date.now();
  }

  isPlaying(): boolean {
    return app.playing;
  }

  toggle(): void {
    if (app.phase !== 'review') return;
    if (app.playing) this.pause();
    else             this.start();
  }

  start(): void {
    if (app.phase !== 'review' || el.rv.readyState < 1) return;
    const start = clipStart();
    const end   = clipEnd();
    // (Re)start from IN when the playhead sits outside the trimmed range.
    const t = player.time();
    if (t < start || t >= end - 0.02) void player.seek(start);
    this.beginPlayback();
  }

  // Start (or keep) playing from an absolute time — a click on the timeline.
  playFrom(time: number): void {
    if (app.phase !== 'review' || el.rv.readyState < 1) return;
    const start = clipStart();
    const end   = clipEnd();
    let t = clampToClip(time, start, end);
    // Land outside anything trimmed away, then off the OUT point, which restarts.
    // While a bar is being dragged, neither rule applies: the whole point is to
    // hear what sits at the bar.
    if (!this.scrubbing) {
      const cutEnd = cutEndFor(t);
      if (cutEnd !== null) t = Math.min(cutEnd, end);
      if (t >= end - 0.02) t = start;
    }
    this.updatePlayhead(t);
    this.askedSkip = 0;
    void player.seek(t);
    if (!app.playing) this.beginPlayback();
  }

  private beginPlayback(): void {
    app.playing = true;
    this.askedSkip = 0;
    this.joinFaded = false;
    fadeReset();               // starting again at full, whatever a pause left behind
    dissolve.clear();              // ...and with no dissolve owed from an earlier join
    this.seenAt = player.time();
    this.seenTime = Date.now();
    this.updateTransport();
    el.rv.play().then(() => this.loop()).catch(() => {
      app.playing = false;
      this.updateTransport();
    });
  }

  pause(): void {
    app.playing = false;
    this.askedSkip = 0;
    this.seekSince = 0;
    this.joinFaded = false;
    if (!el.rv.paused) el.rv.pause();
    fadeReset();               // a fade must never be left half-applied
    dissolve.clear();              // ...nor a dissolve
    this.cancelLoop();
    this.updateTransport();
    this.updatePlayhead();
  }

  reset(): void {
    app.playing = false;
    this.askedSkip = 0;
    this.joinFaded = false;
    this.cancelLoop();
    fadeReset();
    dissolve.clear();
    this.updateTransport();
    this.updatePlayhead(0);
  }

  // Called by the timeline when a trim handle moves.
  syncToTrim(moved: 'start' | 'end'): void {
    if (app.phase !== 'review' || el.rv.readyState < 1) return;
    const start = clipStart();
    const end   = clipEnd();
    if (app.playing) {
      // Keep playing, but never outside the new range.
      const t = clampToClip(player.time(), start, end);
      if (t !== player.time()) { this.askedSkip = 0; void player.seek(t); }
      this.updatePlayhead(t);
    } else {
      // Preview the frame at the handle the user just moved.
      const t = moved === 'start' ? start : end;
      void player.seekAndDraw(t);
      this.updatePlayhead(t);
    }
  }

  // Jump the playhead to an absolute time (thumbnail scrub), keeping transport state.
  seek(time: number): void {
    if (app.phase !== 'review' || el.rv.readyState < 1) return;
    const t = clampToClip(time, clipStart(), clipEnd());
    this.askedSkip = 0;
    this.updatePlayhead(t);
    if (app.playing) void player.seek(t);
    else             void player.seekAndDraw(t);
  }

  // The playhead is shown in timeline time: a trimmed-away stretch has no width on
  // screen, so the head must not sit over it.
  private updatePlayhead(time?: number): void {
    const source = time ?? player.time();
    const kept = keptOf(source);
    const total = keptLengthNow();
    const pct = total > 0 ? (kept / total) * 100 : 0;
    el.playhead.style.left = Math.max(0, Math.min(pct, 100)).toFixed(2) + '%';
    el.tNow.textContent = kept.toFixed(2) + 's';
  }

  private loop(): void {
    if (!app.playing) return;
    const now = Date.now();

    // A seek is not a stall. Jumping over a trimmed stretch means seeking, and a
    // MediaRecorder file can take a while over one, so it is allowed its own,
    // longer time before being given up on.
    if (el.rv.seeking) {
      if (!this.seekSince) this.seekSince = now;
      if (now - this.seekSince > SEEK_MS) { this.pause(); return; }
      app.playRaf = requestAnimationFrame(() => this.loop());
      return;
    }
    if (this.seekSince) {
      this.seekSince = 0;
      if (el.rv.paused && !el.rv.ended) {
        // A seek can leave the clip paused; it was playing, so ask it again.
        this.nudgedAt = now;
        void el.rv.play().catch(() => {});
        app.playRaf = requestAnimationFrame(() => this.loop());
        return;
      }
      this.seenAt = player.time(); this.seenTime = now;      // the stall clock starts fresh
    }

    // Watchdog: a playhead that stops moving means a stalled decode, so stop rather
    // than leaving the transport claiming to play.
    if (player.time() !== this.seenAt) { this.seenAt = player.time(); this.seenTime = now; }
    else if (this.seenTime && now - this.seenTime > STALL_MS) { this.pause(); return; }

    if (el.rv.paused && !el.rv.ended) {
      if (now - this.nudgedAt < NUDGE_MS) { app.playRaf = requestAnimationFrame(() => this.loop()); return; }
      this.pause();
      return;
    }

    // A trimmed-away stretch is jumped over without pausing, so playback carries
    // straight on. The seek is asked for once and the playhead is left alone until
    // the element comes out of the seek, so the browser is not re-asked every frame.
    const cutEnd = this.scrubbing ? null : cutEndFor(player.time());
    if (cutEnd !== null) {
      const to = Math.min(cutEnd, clipEnd());
      if (!el.rv.seeking && this.askedSkip !== to) { this.askedSkip = to; void player.seek(to); }
      this.updatePlayhead(to);
      app.playRaf = requestAnimationFrame(() => this.loop());
      return;
    }
    this.askedSkip = 0;

    if (player.time() >= clipEnd()) {
      void player.seek(clipEnd());
      this.pause();
      return;
    }

    // Another recording follows this one, and the video is nearly at its end:
    // bring the sound down over the last FADE_S, so the join is not abrupt. The
    // sound comes back up as the next recording starts.
    if (player.hasNext() && player.takeLeft() <= FADE_S) {
      if (!this.joinFaded) { this.joinFaded = true; fadeOut(); }
    } else {
      this.joinFaded = false;
    }

    // The recording in the video has run out: carry on into the next one, so the
    // joined clip plays as a whole. Its last frame is held, to dissolve away from.
    if (player.ended()) {
      dissolve.holdFrame();
      void player.next().then(joined => {
        if (!app.playing) return;
        if (!joined) { this.pause(); return; }
        fadeIn(); this.joinFaded = false;      // up from the join's silence
        app.playRaf = requestAnimationFrame(() => this.loop());
      });
      return;
    }

    try { drawClipFrame(el.rv); } catch { /* a frame still decoding — keep the loop alive */ }
    this.updatePlayhead();          // video frames on the preview canvas
    app.playRaf = requestAnimationFrame(() => this.loop());   // audio comes from the (unmuted) element
  }

  private cancelLoop(): void {
    if (app.playRaf !== null) { cancelAnimationFrame(app.playRaf); app.playRaf = null; }
  }

  private updateTransport(): void {
    el.playBtn.innerHTML = app.playing ? PAUSE_ICON : PLAY_ICON;
    el.playBtn.classList.toggle('playing', app.playing);
    el.playBtn.setAttribute('aria-label', app.playing ? 'Pause' : 'Play');
  }
}

export const playback = new Playback();
