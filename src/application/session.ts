// The session: one sitting of the app — the clip and the audio flag.
//
// It is the only owner of the clip. Ending a session is one event: the clip is
// cleared, and every view that shows the clip hears `cleared` and ends its own
// lifetime. The session imports no view module and holds no view state.

import type { Clip } from '../domain/clip/Clip.js';

export class Session {
  audio: boolean;

  constructor(readonly clip: Clip, audio = false) {
    this.audio = audio;
  }

  /** End the session: the clip announces `cleared`, and the views reset themselves. */
  end(): void {
    this.clip.clear();
    this.audio = false;
  }
}
