// The picture at a join, dissolved rather than cut.
//
// The sound is faded either side of a join (fade.ts); the picture is dissolved
// the same way, so a take does not cut into the next. As a take runs out its
// last frame is held, and over the first moments of the next take that frame is
// blended out while the new frames come in — a short cross-dissolve, as long as
// the sound's fade.
//
// The preview and the export draw through the same blend, so what is seen while
// reviewing is what ends up in the file.

import { el } from './dom.js';

export const DISSOLVE_S = 0.08;   // how long the dissolve lasts, in seconds

let held: HTMLCanvasElement | null = null;   // the frame the last take ended on

// Hold a frame to dissolve away from. The frames come from wherever the export
// is drawing them: the video element when it plays the clip through in real
// time, the export's own canvas when it encodes offline.
export function holdFrom(source: CanvasImageSource): void {
  const w = el.cv.width, h = el.cv.height;
  if (!w || !h) return;
  if (!held) held = document.createElement('canvas');
  held.width = w; held.height = h;
  const g = held.getContext('2d');
  if (!g) { held = null; return; }
  g.clearRect(0, 0, w, h);
  try { g.drawImage(source, 0, 0, w, h); } catch { held = null; }
}

// Hold the frame the take in hand is ending on.
export function holdFrame(): void {
  holdFrom(el.rv);
}

// Forget the held frame: a dissolve must not outlive the join it was taken for.
export function clearFrame(): void {
  held = null;
}

// The held frame, for a caller that composites it itself — the offline export
// draws the held frame and then the new one over it, which is the same blend.
export function heldCanvas(): HTMLCanvasElement | null {
  return held;
}

// How much of the new take to show `since` seconds into it: 0 at the join, rising
// to 1 as the dissolve finishes, and null when there is nothing to dissolve.
export function dissolveAlpha(since: number): number | null {
  if (!held || !(since >= 0) || since >= DISSOLVE_S) return null;
  return Math.max(0, Math.min(1, since / DISSOLVE_S));
}

// Draw the frame of `vid` into `g`, dissolving from the held frame for the first
// DISSOLVE_S of a take — `since` being how long that take has been running, so a
// seek into the middle of one draws plainly. The held frame is dropped once the
// dissolve is over, so it is used for one join only. Returns whether it drew the
// dissolve; otherwise the caller draws the plain frame itself.
export function drawDissolve(
  g: CanvasRenderingContext2D, vid: HTMLVideoElement, w: number, h: number, since: number,
): boolean {
  const frame = held;
  if (!frame) return false;
  const k = dissolveAlpha(since);
  if (k === null) {
    if (since >= DISSOLVE_S) held = null;      // spent on this join
    return false;
  }
  g.save();
  g.globalAlpha = 1;
  g.drawImage(frame, 0, 0, w, h);        // the frame being left behind
  g.globalAlpha = k;
  g.drawImage(vid, 0, 0, w, h);         // the new take coming in over it
  g.restore();
  return true;
}
