// The selection: the stretch of the clip the user is pointing at.
//
// It used to be the marks module's own, and it meant "what is about to be cut".
// It is the same two marks and the same section, but it no longer means a cut: it
// is a stretch, and an action is chosen for it — cut it, or annotate it. That is
// what makes one way to point at a stretch serve both.
//
// The marks are view state (they are where the user is looking, not what the clip
// is), so they live here and the session drops them when the clip goes.

import { Span } from '../domain/clip/Span.js';
import { app } from '../state.js';

/** The shortest section worth acting on: a hundredth of the clip. */
export const MIN_SECTION = 0.01;

export const selection = {
  /** Up to two marks, as fractions of the clip. */
  marks: [] as number[],

  /** The span the two marks bound, or null while there is not a pair yet. */
  section(): Span | null {
    return this.marks.length === 2
      ? Span.between(this.marks[0], this.marks[1], MIN_SECTION)
      : null;
  },

  /** Drop whatever is selected. */
  clear(): void {
    this.marks = [];
  },
};

/** How long the selected section is, in seconds, or 0 when there is none. */
export function sectionSeconds(): number {
  const span = selection.section();
  return span ? span.length * app.clip.total() : 0;
}
