// Pure trim / timeline math. No DOM and no browser APIs, so this module can be
// read and tested on its own.
//
// The app trims in two independent ways, and both live here as pure functions:
//
//   * the keep range — `trimStart`/`trimEnd`, dragged with the IN/OUT handles;
//   * the removed regions ("cuts") — bounded by two marks on the timeline.
//
// A "span" is any { s, e } pair; most functions here do not care what unit it is
// in. The app stores cuts as fractions of the clip (0..1) because that is what
// the timeline is drawn in, and converts to seconds only where the media element
// needs them (`cutsInSeconds`).

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

// ── Marks and cuts ───────────────────────────────────────────────────────────
//
// A span is half-open, [s, e). Cuts are spans removed from the kept range: they
// are skipped on playback and on export, never re-encoded away.

export interface Span {
  s: number;
  e: number;
}

// Two marks bound a span; too thin a region is not worth offering.
export function spanBetween(a: number, b: number, minGap = 0): Span | null {
  const s = Math.min(a, b);
  const e = Math.max(a, b);
  return e - s >= minGap ? { s, e } : null;
}

// Add a span, merging anything it touches so the list stays sorted and disjoint.
export function addSpan(spans: Span[], add: Span): Span[] {
  const out: Span[] = [];
  for (const sp of [...spans, add].sort((a, b) => a.s - b.s)) {
    const last = out[out.length - 1];
    if (last && sp.s <= last.e) last.e = Math.max(last.e, sp.e);
    else out.push({ s: sp.s, e: sp.e });
  }
  return out;
}

// Index of the span containing v, or -1.
export function spanAt(spans: Span[], v: number): number {
  return spans.findIndex(sp => v >= sp.s && v < sp.e);
}

// The end of the span containing v, or null when v is not inside one. This is
// where the playhead has to jump to in order to leave a removed region.
export function cutEndAt(spans: Span[], v: number): number | null {
  const i = spanAt(spans, v);
  return i < 0 ? null : spans[i].e;
}

// Length of the spans inside [start, end], counting an overlap only once.
export function spanLength(spans: Span[], start: number, end: number): number {
  let total = 0;
  let covered = -Infinity;                 // end of the last merged span
  for (const sp of [...spans].sort((a, b) => a.s - b.s)) {
    const s = Math.max(sp.s, covered);     // drop whatever an earlier span covered
    if (sp.e <= s) continue;
    const lo = Math.max(s, start);
    const hi = Math.min(sp.e, end);
    if (hi > lo) total += hi - lo;
    covered = sp.e;
  }
  return total;
}

// The length left after a range has had the spans inside it removed.
export function keptLength(spans: Span[], start: number, end: number): number {
  return Math.max(0, (end - start) - spanLength(spans, start, end));
}

// Cuts in seconds, for the media element. The app keeps them as fractions.
export function cutsInSeconds(cuts: Span[], duration: number): Span[] {
  return cuts.map(c => ({ s: c.s * duration, e: c.e * duration }));
}

// Slide a span so that it starts at `toStart`, keeping its length and staying
// inside [0, 1].
export function moveSpan(span: Span, toStart: number): Span {
  const len = span.e - span.s;
  const s = Math.min(Math.max(toStart, 0), 1 - len);
  return { s, e: s + len };
}

// Drag one edge of a span, keeping it at least `min` long and inside [0, 1].
export function resizeSpan(span: Span, edge: 's' | 'e', to: number, min = 0): Span {
  return edge === 's'
    ? { s: Math.min(Math.max(to, 0), span.e - min), e: span.e }
    : { s: span.s, e: Math.max(Math.min(to, 1), span.s + min) };
}
