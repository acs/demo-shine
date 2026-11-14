// Pure trim / timeline math. No DOM and no browser APIs, so this module can be
// read and tested on its own.

export const MIN_TRIM_GAP = 10;   // slider units (the range is 0..1000)
export const SLIDER_MAX = 1000;

export interface Trim {
  s: number;   // IN, in slider units
  en: number;  // OUT, in slider units
}

export function clipSeconds(duration: number, trimStart: number, trimEnd: number): number {
  return (trimEnd - trimStart) * duration;
}

// Keep a playback position inside a clip range, in seconds.
export function clampToClip(time: number, start: number, end: number): number {
  return Math.min(Math.max(time, start), end);
}

// Keep IN and OUT at least `gap` apart. `moved` names the handle the user
// dragged, so the other one stays put.
export function normalizeTrim(
  startVal: number,
  endVal: number,
  moved: 'start' | 'end',
  gap: number = MIN_TRIM_GAP,
): Trim {
  let s = startVal;
  let en = endVal;
  if (s >= en - gap) {
    if (moved === 'start') s = en - gap;
    else                   en = s + gap;
  }
  return { s, en };
}

export function estimateWebmText(clip: number): string {
  const lo = clip * 0.1;    // ~800 Kbps low motion
  const hi = clip * 0.55;   // ~4.4 Mbps high motion
  return `~${lo.toFixed(1)}–${hi.toFixed(1)} MB (WebM)`;
}
