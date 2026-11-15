// The trim and timeline math, as the rest of the app still calls it.
//
// The rules themselves now live in the value objects under domain/clip/ — a range
// knows how to merge and clamp, a set of ranges knows it cannot overlap, a map
// knows the two-way question between the recording and the timeline, and the keep
// range knows its own units. This module is the old free-function face of them.
//
// It is on its way out: its remaining callers are `clip.ts` and
// `offline-export.ts`, which the next two steps rebuild around a `Take`
// repository and a `Clip` aggregate, and the last of it goes with them. Nothing
// new should be written against this file.

import { Span } from './clip/Span.js';
import { SpanSet } from './clip/SpanSet.js';
import { TimelineMap } from './clip/TimelineMap.js';
import { Trim as KeepRange } from './clip/Trim.js';

export { Span };

// Slider units, which is what the IN/OUT handles are dragged in.
export const MIN_TRIM_GAP = KeepRange.MIN_GAP * KeepRange.SLIDER_MAX;
export const SLIDER_MAX = KeepRange.SLIDER_MAX;

/** The keep range as the handles hold it: slider units. */
export interface Trim {
  s: number;   // IN
  en: number;  // OUT
}

export function clipSeconds(duration: number, trimStart: number, trimEnd: number): number {
  return KeepRange.of(trimStart, trimEnd).seconds(duration);
}

// Keep a playback position inside a clip range, in seconds. Not a range rule, so
// it is still a function.
export function clampToClip(time: number, start: number, end: number): number {
  return Math.min(Math.max(time, start), end);
}

export function normalizeTrim(
  startVal: number,
  endVal: number,
  moved: 'start' | 'end',
  gap: number = MIN_TRIM_GAP,
): Trim {
  const { start, end } = KeepRange.fromSlider(startVal, endVal).normalized(moved, gap / SLIDER_MAX).slider;
  return { s: start, en: end };
}

// A rough size for the export, for the timeline to show. Drafting advice rather
// than a rule: this belongs with the view, and moves there when the layers do.
export function estimateWebmText(clip: number): string {
  const lo = clip * 0.1;    // ~800 Kbps low motion
  const hi = clip * 0.55;   // ~4.4 Mbps high motion
  return `~${lo.toFixed(1)}–${hi.toFixed(1)} MB (WebM)`;
}

// ── marks and cuts ───────────────────────────────────────────────────────────

export interface SpanShape {
  s: number;
  e: number;
}

export function spanBetween(a: number, b: number, minGap = 0): Span | null {
  return Span.between(a, b, minGap);
}

export function addSpan(spans: readonly SpanShape[], add: SpanShape): Span[] {
  return [...SpanSet.of(spans).add(add).spans];
}

export function spanAt(spans: readonly SpanShape[], v: number): number {
  const set = SpanSet.of(spans);
  return set.spans.findIndex(span => span.contains(v));
}

export function cutEndAt(spans: readonly SpanShape[], v: number): number | null {
  return SpanSet.of(spans).endAt(v);
}

export function spanLength(spans: readonly SpanShape[], start: number, end: number): number {
  return SpanSet.of(spans).within(start, end);
}

export function keptLength(spans: readonly SpanShape[], start: number, end: number): number {
  return Math.max(0, (end - start) - SpanSet.of(spans).within(start, end));
}

// `total` is not consulted by the mapping — only the removed regions are — so it
// is left at zero here.
export function keptTime(cuts: readonly SpanShape[], source: number): number {
  return TimelineMap.of(cuts, 0).keptOf(source);
}

export function sourceTime(cuts: readonly SpanShape[], kept: number): number {
  return TimelineMap.of(cuts, 0).sourceOf(kept);
}

export function cutsInSeconds(cuts: readonly SpanShape[], duration: number): Span[] {
  return [...SpanSet.of(cuts).scaled(duration).spans];
}

export function moveSpan(span: SpanShape, toStart: number): Span {
  return Span.of(span.s, span.e).movedTo(toStart);
}

export function resizeSpan(span: SpanShape, edge: 's' | 'e', to: number, min = 0): Span {
  return Span.of(span.s, span.e).resized(edge, to, min);
}

// ── several recordings as one clip ───────────────────────────────────────────
//
// About the takes, which the Clip aggregate owns in the next step, so these two
// stay here until it does.

export interface Timed {
  duration: number;
}

export function partStart(parts: readonly Timed[], index: number): number {
  let at = 0;
  for (let i = 0; i < index && i < parts.length; i++) at += parts[i].duration;
  return at;
}

export function partAt(parts: readonly Timed[], time: number): number {
  for (let i = 0; i < parts.length; i++) {
    if (time < partStart(parts, i) + parts[i].duration) return i;
  }
  return Math.max(0, parts.length - 1);
}
