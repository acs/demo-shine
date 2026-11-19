// What a copy puts aside, for a paste.
//
// View state, and an object with a lifetime — the session ends it — for the same
// reason the gestures are: it holds an annotation of the clip on screen, and a clip
// that is gone must not leave one behind. It holds the annotation itself, not a
// shape of its own, because pasting is the annotation's own business
// (`duplicated`), and where the copy goes is not the clipboard's.

import type { Annotation } from '../../domain/annotation/Annotation.js';
import type { Span } from '../../domain/clip/Span.js';

export class Clipboard {
  private held: Annotation | null = null;

  /** Is there something to paste? */
  get has(): boolean {
    return this.held !== null;
  }

  /** How long the held annotation's stretch is, as a fraction of the clip. */
  get length(): number {
    return this.held?.span.length ?? 0;
  }

  /** Put an annotation aside. */
  copy(annotation: Annotation): void {
    this.held = annotation;
  }

  /** A new annotation like the held one, over `span`. Null when nothing is held. */
  paste(span: Span): Annotation | null {
    return this.held?.duplicated(span) ?? null;
  }

  /** The session is over, or the copy is no longer wanted. */
  clear(): void {
    this.held = null;
  }
}

export const clipboard = new Clipboard();
