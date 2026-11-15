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

// Hold the frame the take in hand is ending on, to dissolve away from.
export function holdFrame(): void {
  const w = el.cv.width, h = el.cv.height;
  if (!w || !h) return;
  if (!held) held = document.createElement('canvas');
  held.width = w; held.height = h;
  const g = held.getContext('2d');
  if (!g) { held = null; return; }
  g.clearRect(0, 0, w, h);
  try { g.drawImage(el.rv, 0, 0, w, h); } catch { held = null; }
}

// Forget the held frame: a dissolve must not outlive the join it was taken for.
export function clearFrame(): void {
  held = null;
}

// Draw the frame of `vid` into `g`, dissolving from the held frame for the first
// DISSOLVE_S of a take — `since` being how long that take has been running, so a
// seek into the middle of one draws plainly. The held frame is dropped once the
// dissolve is over, so it is used for one join only. Returns whether it drew the
// dissolve; otherwise the caller draws the plain frame itself.
export function drawDissolve(
  g: CanvasRenderingContext2D, vid: HTMLVideoElement, w: number, h: number, since: number,
): boolean {
  if (!held) return false;
  if (since >= DISSOLVE_S) { held = null; return false; }
  const k = Math.max(0, Math.min(1, since / DISSOLVE_S));   // how much of the new take
  g.save();
  g.globalAlpha = 1;
  g.drawImage(held, 0, 0, w, h);        // the frame being left behind
  g.globalAlpha = k;
  g.drawImage(vid, 0, 0, w, h);         // the new take coming in over it
  g.restore();
  return true;
}
