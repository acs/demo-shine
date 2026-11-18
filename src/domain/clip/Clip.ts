// The clip: the takes and what was cut away. The aggregate.
//
// Everything else in the app asks this object what the clip is. It owns the two
// things that have to agree with each other —
//
//   * the takes, in order, and so the clip's length (the sum of them, derived, so
//     it cannot drift from the takes it is made of);
//   * the cuts — the stretches approved out of it — as a set that cannot overlap.
//
// — and it owns the rules that relate them, which used to be spread between the
// marks module, the exporter and a couple of fields on the app: a cut that is
// approved leaves the timeline, the last one can be put back, the cuts are
// fractions of a clip that grows when a new take arrives, and the kept stretches
// of the clip are what an export is made of.
//
// It takes its takes from a `TakeRepository` (the port), so nothing here touches
// the browser and the whole thing can be tested with a fake collection.

import { Span } from './Span.js';
import { SpanSet } from './SpanSet.js';
import { TimelineMap } from './TimelineMap.js';
import type { Take } from './Take.js';
import type { TakeRepository } from './TakeRepository.js';

/** A stretch of one take that survives the cuts, in seconds of the recording. */
export type Segment = { takeIndex: number; from: number; to: number };

/**
 * A clip written down: the takes it is made of (the recording bytes and the
 * length each one has) and its cuts. `snapshot()` gives one and `restore()` takes
 * one back, and it is the shape a store persists — the blobs are the recordings
 * themselves.
 */
export interface ClipSnapshot {
  takes: ReadonlyArray<{ blob: Blob; duration: number }>;
  cuts: ReadonlyArray<{ s: number; e: number }>;
}

/**
 * What just happened to the clip. The view listens for these instead of
 * re-rendering because it happened to be the caller: the model says what changed,
 * and everything that shows the clip decides what to do about it.
 *
 * Each event carries what a listener needs to react without asking more questions
 * — `previousTotal` is there so a view holding positions as fractions of the clip
 * can re-base them itself, which is what the marks do.
 */
export type ClipEvent =
  | { type: 'take-added'; take: Take; index: number; previousTotal: number }
  | { type: 'cut-approved'; cut: Span; removed: number }
  | { type: 'cut-undone'; cut: Span }
  | { type: 'cleared' };

export type ClipListener = (event: ClipEvent) => void;

export class Clip {
  private lastApproved: { before: SpanSet; cut: Span; removed: number } | null = null;
  private readonly listeners = new Set<ClipListener>();

  private constructor(
    private readonly repo: TakeRepository,
    private removed: SpanSet,
  ) {}

  /** A clip with nothing in it yet. */
  static empty(takes: TakeRepository): Clip {
    return new Clip(takes, SpanSet.EMPTY);
  }

  /** Listen for what happens to the clip. Call the returned function to stop. */
  onChange(listener: ClipListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get takes(): TakeRepository {
    return this.repo;
  }

  /** What was cut away, as fractions of the clip, in one non-overlapping set. */
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

  /** How long the clip is once the cuts are gone: what an export holds. */
  keptLength(): number {
    return this.timeline().kept;
  }

  /**
   * A new recording at the end. The clip is longer, and the cuts are
   * fractions of it, so they are re-based to stay over the same moments — and the
   * last one cannot be undone across a join it was never measured against.
   */
  addTake(blob: Blob, duration: number): Take {
    const before = this.total();
    const take = this.repo.add(blob, duration);
    const now = this.total();
    if (before > 0 && now > before) this.removed = this.removed.scaled(before / now);
    this.lastApproved = null;
    this.announce({ type: 'take-added', take, index: this.repo.count() - 1, previousTotal: before });
    return take;
  }

  /**
   * Approve a cut: it leaves the timeline, and how much that was worth comes
   * back. The cut is held so it can be put back.
   */
  approve(cut: Span): number {
    const before = this.keptLength();
    const previous = this.removed;
    this.removed = this.removed.add(cut);
    const removed = before - this.keptLength();
    this.lastApproved = { before: previous, cut, removed };
    this.announce({ type: 'cut-approved', cut, removed });
    return removed;
  }

  /** Is there a cut to put back? */
  canUndo(): boolean {
    return this.lastApproved !== null;
  }

  /** How many seconds the last approved cut took off the timeline. */
  lastRemoved(): number {
    return this.lastApproved?.removed ?? 0;
  }

  /** Put the last approved cut back, and say which one it was. */
  undo(): Span | null {
    const last = this.lastApproved;
    if (!last) return null;
    this.removed = last.before;
    this.lastApproved = null;
    this.announce({ type: 'cut-undone', cut: last.cut });
    return last.cut;
  }

  /**
   * The kept stretches of a range of the recording, in seconds, each saying which
   * take it belongs to. This is what an export is made of, and it is the clip's
   * answer rather than the exporter's loop.
   */
  segmentsIn(from: number, to: number): Segment[] {
    const takes = this.repo.all();
    const gone = this.removed.scaled(this.total());     // the cuts, in seconds
    const out: Segment[] = [];
    let at = from;
    while (at < to - 0.001) {
      const cutEnd = gone.endAt(at);
      if (cutEnd !== null) { at = Math.min(cutEnd, to); continue; }
      const index = this.repo.indexAt(at);
      let end = Math.min(to, takes[index] ? this.repo.startOf(index) + takes[index].duration : to);
      for (const cut of gone.spans) if (cut.s > at + 0.001 && cut.s < end) end = cut.s;
      if (end <= at + 0.001) break;
      out.push({ takeIndex: index, from: at, to: end });
      at = end;
    }
    return out;
  }

  /**
   * Everything this clip is made of, so it can be written down and read back:
   * its takes and its cuts.
   */
  snapshot(): ClipSnapshot {
    return {
      takes: this.repo.all().map(take => ({ blob: take.blob, duration: take.duration })),
      cuts: this.removed.spans.map(span => ({ s: span.s, e: span.e })),
    };
  }

  /**
   * Rebuild this clip from a snapshot — the takes and the cuts. Nothing is
   * announced: a restore is a load rather than a change to a clip already on
   * screen, and the flow that restores sets the view up itself. The takes already
   * in the repository are dropped, object URLs and all.
   */
  restore(snapshot: ClipSnapshot): void {
    this.repo.clear();
    for (const take of snapshot.takes) this.repo.add(take.blob, take.duration);
    this.removed = SpanSet.of(snapshot.cuts);
    this.lastApproved = null;
  }

  /** The session is over. */
  clear(): void {
    this.repo.clear();
    this.removed = SpanSet.EMPTY;
    this.lastApproved = null;
    this.announce({ type: 'cleared' });
  }

  /** Tell the listeners, on a copy of the set so one may unsubscribe while it runs. */
  private announce(event: ClipEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }
}
