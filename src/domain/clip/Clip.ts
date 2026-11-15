// The clip: the takes, what was trimmed away, and the keep range. The aggregate.
//
// Everything else in the app asks this object what the clip is. It owns the three
// things that have to agree with each other —
//
//   * the takes, in order, and so the clip's length (the sum of them, derived, so
//     it cannot drift from the takes it is made of);
//   * the keep range, as a fraction of that length;
//   * the regions that were trimmed away, as a set that cannot overlap.
//
// — and it owns the rules that relate them, which used to be spread between the
// marks module, the exporter and a couple of fields on the app: a trim that is
// approved leaves the timeline, the last one can be put back, the regions are
// fractions of a clip that grows when a new take arrives, and the kept stretches
// of a range are what an export is made of.
//
// It takes its takes from a `TakeRepository` (the port), so nothing here touches
// the browser and the whole thing can be tested with a fake collection.

import { Span } from './Span.js';
import { SpanSet } from './SpanSet.js';
import { TimelineMap } from './TimelineMap.js';
import { Trim } from './Trim.js';
import type { Take } from './Take.js';
import type { TakeRepository } from './TakeRepository.js';

/** A stretch of one take that survives the trims, in seconds of the recording. */
export type Segment = { part: number; from: number; to: number };

export class Clip {
  private keep = Trim.of(0, 1);
  private lastApproved: { before: SpanSet; region: Span; removed: number } | null = null;

  private constructor(
    private readonly repo: TakeRepository,
    private removed: SpanSet,
  ) {}

  /** A clip with nothing in it yet. */
  static empty(takes: TakeRepository): Clip {
    return new Clip(takes, SpanSet.EMPTY);
  }

  get takes(): TakeRepository {
    return this.repo;
  }

  /** The keep range, as a fraction of the clip. */
  get trim(): Trim {
    return this.keep;
  }

  /** What was trimmed away, as fractions of the clip, in one non-overlapping set. */
  get cuts(): SpanSet {
    return this.removed;
  }

  /** How long the clip is: the sum of its takes, never a field beside them. */
  total(): number {
    return this.repo.totalDuration();
  }

  /** The recording and the timeline, mapped both ways. */
  timeline(): TimelineMap {
    return TimelineMap.forClip(this.removed.spans, this.total());
  }

  /** How much is left to export, in seconds. */
  keptLength(): number {
    const duration = this.total();
    return this.timeline().keptLength(this.keep.start * duration, this.keep.end * duration);
  }

  /** The handles were dragged. */
  keepRange(trim: Trim): void {
    this.keep = trim;
  }

  /**
   * A new recording at the end. The clip is longer, and the removed regions are
   * fractions of it, so they are re-based to stay over the same moments — and the
   * last one cannot be undone across a join it was never measured against.
   */
  addTake(blob: Blob, duration: number): Take {
    const before = this.total();
    const take = this.repo.add(blob, duration);
    const now = this.total();
    if (before > 0 && now > before) this.removed = this.removed.scaled(before / now);
    this.lastApproved = null;
    return take;
  }

  /**
   * Approve a region: it leaves the timeline, and how much that was worth comes
   * back. The region is held so it can be put back.
   */
  approve(region: Span): number {
    const before = this.keptLength();
    const previous = this.removed;
    this.removed = this.removed.add(region);
    const removed = before - this.keptLength();
    this.lastApproved = { before: previous, region, removed };
    return removed;
  }

  /** Is there a trim to put back? */
  canUndo(): boolean {
    return this.lastApproved !== null;
  }

  /** How many seconds the last approved trim took off the timeline. */
  lastRemoved(): number {
    return this.lastApproved?.removed ?? 0;
  }

  /** Put the last approved region back, and say which one it was. */
  undo(): Span | null {
    const last = this.lastApproved;
    if (!last) return null;
    this.removed = last.before;
    this.lastApproved = null;
    return last.region;
  }

  /**
   * The kept stretches of a range of the recording, in seconds, each saying which
   * take it belongs to. This is what an export is made of, and it is the clip's
   * answer rather than the exporter's loop.
   */
  segmentsIn(from: number, to: number): Segment[] {
    const takes = this.repo.all();
    const gone = this.removed.scaled(this.total());     // the regions, in seconds
    const out: Segment[] = [];
    let at = from;
    while (at < to - 0.001) {
      const cutEnd = gone.endAt(at);
      if (cutEnd !== null) { at = Math.min(cutEnd, to); continue; }
      const index = this.repo.indexAt(at);
      let end = Math.min(to, takes[index] ? this.repo.startOf(index) + takes[index].duration : to);
      for (const cut of gone.spans) if (cut.s > at + 0.001 && cut.s < end) end = cut.s;
      if (end <= at + 0.001) break;
      out.push({ part: index, from: at, to: end });
      at = end;
    }
    return out;
  }

  /** The session is over. */
  clear(): void {
    this.repo.clear();
    this.removed = SpanSet.EMPTY;
    this.keep = Trim.of(0, 1);
    this.lastApproved = null;
  }
}
