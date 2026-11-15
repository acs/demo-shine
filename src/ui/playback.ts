// Playback of the recorded clip, rendered on the preview canvas with sound and
// kept in sync with the trim handles: playback is bounded by IN/OUT, and moving
// a handle while playing re-clamps the playhead; while paused, moving a handle
// previews that handle's frame.
//
// Removed regions ("cuts") are jumped over as they are reached, without pausing,
// so the trimmed clip plays as one continuous piece. Three pieces of state make
// that work:
//
//   askedSkip   the cut end already seeked to — each jump is asked for once, not
//               once per frame, so the browser is never re-asked mid-seek
//   scrubbing   a bar is being dragged: play even inside a cut, which is the
//               whole point of dragging one
//   seenAt/seenTime   watchdog — if the playhead really will not move, stop
//               rather than leave the transport claiming to play

import { app } from '../state.js';
import { el } from './dom.js';
import { drawClipFrame } from './preview.js';
import { clampToClip, cutEndAt } from '../domain/timeline.js';
import { clipNext, clipSeek, clipSeekAndDraw, clipTime, hasNextPart, keptLengthNow, keptOf, partEnded, partLeft } from './clip.js';
import { FADE_S, fadeIn, fadeOut, fadeReset } from './fade.js';
import { clearFrame, holdFrame } from './dissolve.js';

const PLAY_ICON  = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const PAUSE_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>';

const STALL_MS  = 2500;   // how long the playhead may stand still before we stop
const SEEK_MS   = 12000;  // ...but a seek gets longer: jumping a trim means seeking
const NUDGE_MS  = 600;    // ...and a seek that left the clip paused gets a moment

const clipStart = () => app.trimStart * app.duration;
const clipEnd   = () => app.trimEnd * app.duration;

let askedSkip = 0;       // cut end already seeked to, so it is asked for once
let seekSince = 0;       // when the seek in flight started (0 = none)
let nudgedAt  = 0;       // when playback was last re-asked for after a seek
let scrubbing = false;   // a bar is being dragged: play even inside a cut
let seenAt    = 0;       // watchdog: position of the playhead at the last look
let seenTime  = 0;       // watchdog: when that look happened
let joinFaded = false;   // the sound is down for a join that is coming

// The end of the removed region the playhead sits in, in seconds, or null when
// it is not inside one. The cuts are stored as fractions of the clip.
function cutEndFor(t: number): number | null {
  if (!(app.duration > 0)) return null;
  const end = cutEndAt(app.cuts, t / app.duration);
  return end === null ? null : end * app.duration;
}

// While a bar is dragged the clip is played from wherever it is, including the
// inside of a removed region — otherwise there would be nothing to hear.
export function setScrubbing(on: boolean): void {
  scrubbing = on;
  askedSkip = 0;
  seenAt = clipTime();
  seenTime = Date.now();
}

export function isPlaying(): boolean {
  return app.playing;
}

export function togglePlayback(): void {
  if (app.phase !== 'review') return;
  if (app.playing) pausePlayback();
  else             startPlayback();
}

export function startPlayback(): void {
  if (app.phase !== 'review' || el.rv.readyState < 1) return;
  const start = clipStart();
  const end   = clipEnd();
  // (Re)start from IN when the playhead sits outside the trimmed range.
  const t = clipTime();
  if (t < start || t >= end - 0.02) void clipSeek(start);
  beginPlayback();
}

// Start (or keep) playing from an absolute time — a click on the timeline.
export function playFrom(time: number): void {
  if (app.phase !== 'review' || el.rv.readyState < 1) return;
  const start = clipStart();
  const end   = clipEnd();
  let t = clampToClip(time, start, end);
  // Land outside anything trimmed away, then off the OUT point, which restarts.
  // While a bar is being dragged, neither rule applies: the whole point is to
  // hear what sits at the bar.
  if (!scrubbing) {
    const cutEnd = cutEndFor(t);
    if (cutEnd !== null) t = Math.min(cutEnd, end);
    if (t >= end - 0.02) t = start;
  }
  updatePlayhead(t);
  askedSkip = 0;
  void clipSeek(t);
  if (!app.playing) beginPlayback();
}

function beginPlayback(): void {
  app.playing = true;
  askedSkip = 0;
  joinFaded = false;
  fadeReset();               // starting again at full, whatever a pause left behind
  clearFrame();              // ...and with no dissolve owed from an earlier join
  seenAt = clipTime();
  seenTime = Date.now();
  updateTransport();
  el.rv.play().then(loop).catch(() => {
    app.playing = false;
    updateTransport();
  });
}

export function pausePlayback(): void {
  app.playing = false;
  askedSkip = 0;
  seekSince = 0;
  joinFaded = false;
  if (!el.rv.paused) el.rv.pause();
  fadeReset();               // a fade must never be left half-applied
  clearFrame();              // ...nor a dissolve
  cancelLoop();
  updateTransport();
  updatePlayhead();
}

export function resetPlayback(): void {
  app.playing = false;
  askedSkip = 0;
  joinFaded = false;
  cancelLoop();
  fadeReset();
  clearFrame();
  updateTransport();
  updatePlayhead(0);
}

// Called by the timeline when a trim handle moves.
export function syncToTrim(moved: 'start' | 'end'): void {
  if (app.phase !== 'review' || el.rv.readyState < 1) return;
  const start = clipStart();
  const end   = clipEnd();
  if (app.playing) {
    // Keep playing, but never outside the new range.
    const t = clampToClip(clipTime(), start, end);
    if (t !== clipTime()) { askedSkip = 0; void clipSeek(t); }
    updatePlayhead(t);
  } else {
    // Preview the frame at the handle the user just moved.
    const t = moved === 'start' ? start : end;
    void clipSeekAndDraw(t);
    updatePlayhead(t);
  }
}

// Jump the playhead to an absolute time (thumbnail scrub), keeping transport state.
export function seekPlayback(time: number): void {
  if (app.phase !== 'review' || el.rv.readyState < 1) return;
  const t = clampToClip(time, clipStart(), clipEnd());
  askedSkip = 0;
  updatePlayhead(t);
  if (app.playing) void clipSeek(t);
  else             void clipSeekAndDraw(t);
}

// The playhead is shown in timeline time: a trimmed-away stretch has no width on
// screen, so the head must not sit over it.
function updatePlayhead(time?: number): void {
  const source = time ?? clipTime();
  const kept = keptOf(source);
  const total = keptLengthNow();
  const pct = total > 0 ? (kept / total) * 100 : 0;
  el.playhead.style.left = Math.max(0, Math.min(pct, 100)).toFixed(2) + '%';
  el.tNow.textContent = kept.toFixed(2) + 's';
}

function loop(): void {
  if (!app.playing) return;
  const now = Date.now();

  // A seek is not a stall. Jumping over a trimmed stretch means seeking, and a
  // MediaRecorder file can take a while over one, so it is allowed its own,
  // longer time before being given up on.
  if (el.rv.seeking) {
    if (!seekSince) seekSince = now;
    if (now - seekSince > SEEK_MS) { pausePlayback(); return; }
    app.playRaf = requestAnimationFrame(loop);
    return;
  }
  if (seekSince) {
    seekSince = 0;
    if (el.rv.paused && !el.rv.ended) {
      // A seek can leave the clip paused; it was playing, so ask it again.
      nudgedAt = now;
      void el.rv.play().catch(() => {});
      app.playRaf = requestAnimationFrame(loop);
      return;
    }
    seenAt = clipTime(); seenTime = now;      // the stall clock starts fresh
  }

  // Watchdog: a playhead that stops moving means a stalled decode, so stop rather
  // than leaving the transport claiming to play.
  if (clipTime() !== seenAt) { seenAt = clipTime(); seenTime = now; }
  else if (seenTime && now - seenTime > STALL_MS) { pausePlayback(); return; }

  if (el.rv.paused && !el.rv.ended) {
    if (now - nudgedAt < NUDGE_MS) { app.playRaf = requestAnimationFrame(loop); return; }
    pausePlayback();
    return;
  }

  // A trimmed-away stretch is jumped over without pausing, so playback carries
  // straight on. The seek is asked for once and the playhead is left alone until
  // the element comes out of the seek, so the browser is not re-asked every frame.
  const cutEnd = scrubbing ? null : cutEndFor(clipTime());
  if (cutEnd !== null) {
    const to = Math.min(cutEnd, clipEnd());
    if (!el.rv.seeking && askedSkip !== to) { askedSkip = to; void clipSeek(to); }
    updatePlayhead(to);
    app.playRaf = requestAnimationFrame(loop);
    return;
  }
  askedSkip = 0;

  if (clipTime() >= clipEnd()) {
    void clipSeek(clipEnd());
    pausePlayback();
    return;
  }

  // Another recording follows this one, and the video is nearly at its end:
  // bring the sound down over the last FADE_S, so the join is not abrupt. The
  // sound comes back up as the next recording starts.
  if (hasNextPart() && partLeft() <= FADE_S) {
    if (!joinFaded) { joinFaded = true; fadeOut(); }
  } else {
    joinFaded = false;
  }

  // The recording in the video has run out: carry on into the next one, so the
  // joined clip plays as a whole. Its last frame is held, to dissolve away from.
  if (partEnded()) {
    holdFrame();
    void clipNext().then(joined => {
      if (!app.playing) return;
      if (!joined) { pausePlayback(); return; }
      fadeIn(); joinFaded = false;      // up from the join's silence
      app.playRaf = requestAnimationFrame(loop);
    });
    return;
  }

  try { drawClipFrame(el.rv); } catch { /* a frame still decoding — keep the loop alive */ }
  updatePlayhead();          // video frames on the preview canvas
  app.playRaf = requestAnimationFrame(loop);   // audio comes from the (unmuted) element
}

function cancelLoop(): void {
  if (app.playRaf !== null) { cancelAnimationFrame(app.playRaf); app.playRaf = null; }
}

function updateTransport(): void {
  el.playBtn.innerHTML = app.playing ? PAUSE_ICON : PLAY_ICON;
  el.playBtn.classList.toggle('playing', app.playing);
  el.playBtn.setAttribute('aria-label', app.playing ? 'Pause' : 'Play');
}
