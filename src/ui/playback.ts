// Playback of the recorded clip, rendered on the preview canvas with sound and
// kept in sync with the trim handles: playback is bounded by IN/OUT, and moving
// a handle while playing re-clamps the playhead; while paused, moving a handle
// previews that handle's frame.

import { app } from '../state.js';
import { el } from './dom.js';
import { drawFrame, seekAndDraw } from './preview.js';
import { clampToClip, type Span } from '../domain/timeline.js';

const PLAY_ICON  = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const PAUSE_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>';

const STALL_MS = 2500;   // how long the playhead may stand still before we stop

const clipStart = () => app.trimStart * app.duration;
const clipEnd   = () => app.trimEnd * app.duration;

let skipped  = 0;        // cut end already seeked to, so it is asked for once
let seenAt   = 0;        // watchdog: position of the playhead at the last look
let seenTime = 0;        // watchdog: when that look happened

export function isPlaying(): boolean {
  return app.playing;
}

export function togglePlayback(): void {
  if (app.phase !== 'review') return;
  if (app.playing) pausePlayback();
  else             startPlayback();
}

export function startPlayback(): void {
  if (app.phase !== 'review' || el.rv.readyState < 2) return;
  const start = clipStart();
  const end   = clipEnd();
  // (Re)start from IN when the playhead sits outside the trimmed range.
  if (el.rv.currentTime < start || el.rv.currentTime >= end - 0.02) el.rv.currentTime = start;
  beginPlayback();
}

// Start (or keep) playing from an absolute time — a click on the timeline.
export function playFrom(time: number): void {
  if (app.phase !== 'review' || el.rv.readyState < 2) return;
  const start = clipStart();
  const end   = clipEnd();
  let t = clampToClip(time, start, end);
  // Land outside anything trimmed away, then off the OUT point, which restarts.
  const cut = cutAt(t);
  if (cut) t = Math.min(cut.e, end);
  if (t >= end - 0.02) t = start;
  updatePlayhead(t);
  skipped = 0;
  el.rv.currentTime = t;
  if (!app.playing) beginPlayback();
}

// The cut region containing an absolute time, in seconds.
function cutAt(t: number): Span | null {
  const d = app.duration;
  for (const c of app.cuts) {
    const s = c.s * d;
    const e = c.e * d;
    if (t >= s && t < e) return { s, e };
  }
  return null;
}

function beginPlayback(): void {
  app.playing = true;
  skipped = 0;
  seenAt = el.rv.currentTime;
  seenTime = Date.now();
  updateTransport();
  el.rv.play().then(loop).catch(() => {
    app.playing = false;
    updateTransport();
  });
}

export function pausePlayback(): void {
  app.playing = false;
  skipped = 0;
  if (!el.rv.paused) el.rv.pause();
  cancelLoop();
  updateTransport();
  updatePlayhead();
}

export function resetPlayback(): void {
  app.playing = false;
  skipped = 0;
  cancelLoop();
  updateTransport();
  updatePlayhead(0);
}

// Called by the timeline when a trim handle moves.
export function syncToTrim(moved: 'start' | 'end'): void {
  if (app.phase !== 'review' || el.rv.readyState < 2) return;
  const start = clipStart();
  const end   = clipEnd();
  if (app.playing) {
    // Keep playing, but never outside the new range.
    const t = clampToClip(el.rv.currentTime, start, end);
    if (t !== el.rv.currentTime) { skipped = 0; el.rv.currentTime = t; }
    updatePlayhead(t);
  } else {
    // Preview the frame at the handle the user just moved.
    const t = moved === 'start' ? start : end;
    void seekAndDraw(el.rv, t);
    updatePlayhead(t);
  }
}

// Jump the playhead to an absolute time (thumbnail scrub), keeping transport state.
export function seekPlayback(time: number): void {
  if (app.phase !== 'review' || el.rv.readyState < 2) return;
  const t = clampToClip(time, clipStart(), clipEnd());
  skipped = 0;
  el.rv.currentTime = t;
  updatePlayhead(t);
  if (!app.playing) void seekAndDraw(el.rv, t);
}

function loop(): void {
  if (!app.playing) return;
  const now = Date.now();

  // Watchdog: a playhead that stops moving means a stalled decode or seek, so
  // stop rather than leaving the transport claiming to play.
  if (el.rv.currentTime !== seenAt) { seenAt = el.rv.currentTime; seenTime = now; }
  else if (seenTime && now - seenTime > STALL_MS) { pausePlayback(); return; }

  if (el.rv.paused || el.rv.ended) { pausePlayback(); return; }

  // A trimmed-away stretch is jumped over without pausing, so playback carries
  // straight on. The seek is asked for once and the playhead is left alone until
  // the element comes out of the seek, so the browser is not re-asked every frame.
  const cut = cutAt(el.rv.currentTime);
  if (cut) {
    const to = Math.min(cut.e, clipEnd());
    if (!el.rv.seeking && skipped !== to) { skipped = to; el.rv.currentTime = to; }
    updatePlayhead(to);
    app.playRaf = requestAnimationFrame(loop);
    return;
  }
  skipped = 0;

  if (el.rv.currentTime >= clipEnd()) {
    el.rv.currentTime = clipEnd();
    drawFrame(el.rv);
    pausePlayback();
    return;
  }

  try { drawFrame(el.rv); } catch { /* a frame still decoding — keep the loop alive */ }
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

function updatePlayhead(time?: number): void {
  const t   = time ?? el.rv.currentTime;
  const pct = app.duration > 0 ? (t / app.duration) * 100 : 0;
  el.playhead.style.left = Math.max(0, Math.min(pct, 100)).toFixed(2) + '%';
  el.tNow.textContent = t.toFixed(2) + 's';
}
