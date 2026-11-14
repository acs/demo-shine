// Pure trim / timeline math. No DOM and no browser APIs, so this module can be
// read and tested on its own.

export const MIN_TRIM_GAP = 10;   // slider units (the range is 0..1000)
export const SLIDER_MAX = 1000;

export function clipSeconds(duration, trimStart, trimEnd) {
  return (trimEnd - trimStart) * duration;
}

// Keep IN and OUT at least `gap` apart. `moved` is 'start' or 'end' and names
// the handle the user dragged, so the other one stays put.
export function normalizeTrim(startVal, endVal, moved, gap = MIN_TRIM_GAP) {
  let s = startVal;
  let en = endVal;
  if (s >= en - gap) {
    if (moved === 'start') s = en - gap;
    else                   en = s + gap;
  }
  return { s, en };
}

export function estimateWebmText(clip) {
  const lo = clip * 0.1;    // ~800 Kbps low motion
  const hi = clip * 0.55;   // ~4.4 Mbps high motion
  return `~${lo.toFixed(1)}–${hi.toFixed(1)} MB (WebM)`;
}

export function estimateGifText(clip, fps, captureW, captureH) {
  const gW = Math.min(captureW, 960);
  const gH = Math.round(captureH * (gW / captureW));
  const frames = Math.ceil(clip * fps);
  const mb = (frames * gW * gH) / 5 / 1048576;   // ~5× compression typical
  return mb < 1
    ? `~${Math.round(mb * 1024)} KB (GIF)`
    : `~${mb.toFixed(1)} MB (GIF)`;
}
