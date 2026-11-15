// Playback of the recorded clip, rendered on the preview canvas with sound and
// kept in sync with the trim handles: playback is bounded by IN/OUT, and moving
// a handle while playing re-clamps the playhead; while paused, moving a handle
// previews that handle's frame.

import { app } from '../state.js';
import { el } from './dom.js';
import { drawFrame, seekAndDraw, seekWithin } from './preview.js';
import { clampToClip, type Span } from '../domain/timeline.js';

const PLAY_ICON  = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const PAUSE_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>';

const STALL_MS = 2500;   // how long the playhead may stand still before we stop

const clipStart = () => app.trimStart * app.duration;
const clipEnd   = () => app.trimEnd * app.duration;

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
  if (app.playing) {
    hop(t);                       // a mid-playback seek has to be done carefully
  } else {
    el.rv.currentTime = t;        // seeking while paused is reliable
    beginPlayback();
  }
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

// Move the playhead while playing. Seeking a MediaRecorder WebM mid-playback is
// unreliable — the element can settle into a seek that never finishes, which
// silences the sound and freezes the picture while the transport still claims to
// be playing. So pause, seek, wait for it, then play on.
//
// Requests that arrive while a hop is running are coalesced into the next one,
// so a burst of clicks ends up where the last click asked.
let hopTo: number | null = null;
let hopping = false;

function hop(to: number): void {
  hopTo = to;
  if (!hopping) void runHops();
}

async function runHops(): Promise<void> {
  hopping = true;
  let guard = 0;
  while (hopTo !== null && app.playing && guard++ < 6) {
    const to = hopTo;
    const from = el.rv.currentTime;
    hopTo = null;
    el.rv.pause();
    if (!(await seekWithin(el.rv, to))) { stopHop(); return; }

    const stuck = cutAt(el.rv.currentTime);
    if (stuck) {
      // A browser that will not actually move must not send us round in circles.
      if (Math.abs(el.rv.currentTime - from) < 0.05) { stopHop(); return; }
      if (hopTo === null) hopTo = Math.min(stuck.e, clipEnd());
    }
    seenAt = el.rv.currentTime;
    seenTime = Date.now();
  }
  hopping = false;
  hopTo = null;
  if (!app.playing) return;
  try {
    await el.rv.play();
  } catch {
    pausePlayback();
    return;
  }
  if (app.playing) app.playRaf = requestAnimationFrame(loop);
}

function stopHop(): void {
  hopping = false;
  hopTo = null;
  pausePlayback();
}

function beginPlayback(): void {
  app.playing = true;
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
  hopTo = null;
  hopping = false;
  if (!el.rv.paused) el.rv.pause();
  cancelLoop();
  updateTransport();
  updatePlayhead();
}

export function resetPlayback(): void {
  app.playing = false;
  hopTo = null;
  hopping = false;
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
    if (t !== el.rv.currentTime) hop(t);
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
  updatePlayhead(t);
  if (app.playing) { hop(t); return; }
  el.rv.currentTime = t;
  void seekAndDraw(el.rv, t);
}

function loop(): void {
  if (!app.playing || hopping) return;
  const now = Date.now();

  // Watchdog: a playhead that stops moving means a stalled decode or seek, so
  // give up the transport rather than leaving the button stuck on pause.
  if (el.rv.currentTime !== seenAt) { seenAt = el.rv.currentTime; seenTime = now; }
  else if (seenTime && now - seenTime > STALL_MS) { pausePlayback(); return; }

  if (el.rv.paused || el.rv.ended) { pausePlayback(); return; }

  const cut = cutAt(el.rv.currentTime);
  if (cut) { hop(Math.min(cut.e, clipEnd())); return; }   // hop over the trimmed part

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
