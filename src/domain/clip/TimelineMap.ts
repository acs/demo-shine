// The kept timeline: what survives the cuts, and the two-way question
// that follows — where does a moment of the recording appear to the user, and
// which moment of the recording is a point on the timeline?
//
// It holds the cuts in **seconds**, and whoever builds it says what unit they
// were given. That is the point of the class: the app stores cuts as fractions
// (the timeline is drawn in fractions) and the media element wants seconds, and
// passing one where the other was meant is the mistake this removes — it is what
// once parked the playhead a whole stretch short of a join.

import { SpanSet, type SpanLike } from './SpanSet.js';
import { Span } from './Span.js';

export class TimelineMap {
  private constructor(
    private readonly removed: SpanSet,
    private readonly total: number,
  ) {}

  /** From cuts that are already in seconds. */
  static of(cutsInSeconds: readonly SpanLike[], totalSeconds: number): TimelineMap {
    return new TimelineMap(SpanSet.of(cutsInSeconds), totalSeconds);
  }

  /** From the fractions of the clip the app stores, and the clip's duration. */
  static forClip(cutsAsFractions: readonly SpanLike[], durationSeconds: number): TimelineMap {
    return new TimelineMap(SpanSet.of(cutsAsFractions).scaled(durationSeconds), durationSeconds);
  }

  /** Nothing removed. */
  static none(totalSeconds: number): TimelineMap {
    return new TimelineMap(SpanSet.EMPTY, totalSeconds);
  }

  /** The cuts, in seconds. */
  get cuts(): readonly Span[] {
    return this.removed.spans;
  }

  /** The recording's own length. */
  get length(): number {
    return this.total;
  }

  /** The length left after the cuts, over the whole recording. */
  get kept(): number {
    return this.keptLength(0, this.total);
  }

  /** How long [start, end] is once the cuts inside it are gone. */
  keptLength(start: number, end: number): number {
    return Math.max(0, (end - start) - this.removed.within(start, end));
  }

  /** Is this moment of the recording inside a cut? */
  contains(source: number): boolean {
    return this.removed.contains(source);
  }

  /** Where to jump to leave the cut containing `source`, or null. */
  endAt(source: number): number | null {
    return this.removed.endAt(source);
  }

  /**
   * A moment of the recording, as the timeline shows it. The two are inverses of
   * each other, except exactly at the edge of a cut, where `keptOf`
   * gives the time before it and `sourceOf` the time after.
   */
  keptOf(source: number): number {
    let kept = source;
    for (const cut of this.removed.spans) {
      if (source <= cut.s) break;
      kept -= Math.min(source, cut.e) - cut.s;
    }
    return Math.max(0, kept);
  }

  /**
   * A moment on the timeline, as the recording holds it.
   */
  sourceOf(kept: number): number {
    let source = kept;
    for (const cut of this.removed.spans) {
      if (source < cut.s) break;
      source += cut.length;
    }
    return source;
  }
}
