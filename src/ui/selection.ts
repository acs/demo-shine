// The selection: the stretch of the clip the user is pointing at.
//
// It used to be the marks module's own, and it meant "what is about to be cut".
// It is the same two marks and the same section, but it no longer means a cut: it is
// a stretch, and an action is chosen for it — cut it, or annotate it. That is what
// makes one way to point at a stretch serve both.
//
// It is a class, as every other view state in the app is: it holds the marks and the
// rule about what they bound, and it has a lifetime the session ends.

import { Span } from '../domain/clip/Span.js';

/** The shortest section worth acting on: a hundredth of the clip. */
export const MIN_SECTION = 0.01;

export class Selection {
  /** Up to two marks, as fractions of the clip. */
  marks: number[] = [];

  /** The span the two marks bound, or null while there is not a pair yet. */
  section(): Span | null {
    return this.marks.length === 2
      ? Span.between(this.marks[0], this.marks[1], MIN_SECTION)
      : null;
  }

  /** Drop whatever is selected. */
  clear(): void {
    this.marks = [];
  }
}

export const selection = new Selection();
