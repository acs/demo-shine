// The session: what one sitting of the app holds, and the one place that lets go
// of it.
//
// A session is a clip — its takes, its keep range, its cuts — and the view state
// that belongs to showing it: the timeline while a take is recording, where the
// playhead is, the waveform, which take the video is holding, and the elements
// that only mean anything while there is a clip. Starting over used to be thirty
// lines of manual tidying at the end of the export flow; it is one call here
// instead, and it is the same call whether a person pressed Reset or the share
// went away.
//
// Each view module owns the object its state lives on — the `LiveTimeline` that
// fills while a take records, the `Playback` that runs the transport — and the
// session is what ends those lifetimes: everything below is "this session is
// over". The view state still kept in module variables (the waveform's peaks, the
// clip's loaded take) is reached through its own reset for now and will move the
// same way.
//
// What deliberately stays out is the flow: letting go of the shared screen, the
// phase, and asking for a screen again. That is the reset button's business, not
// the session's.

import { app } from './state.js';
import { el } from './ui/dom.js';
import { drawGrid } from './ui/preview.js';
import { setTimerMs } from './ui/timer.js';
import { updateSizeUI } from './ui/timeline-ui.js';
import { forgetLoaded } from './ui/clip.js';
import { playback } from './ui/playback.js';
import { waveform } from './ui/waveform.js';
import { liveTimeline } from './ui/live-timeline.js';

export class Session {
  /**
   * Everything the session holds goes back to nothing: the clip, the view of it,
   * and the state that only means something while it is there. The takes' object
   * URLs go with the clip — the repository made them and revokes them, so there
   * is nothing to do about them here.
   */
  reset(): void {
    liveTimeline.stop();
    // The element was holding a take that no longer exists: let go of it rather
    // than revoke its URL a second time.
    if (el.rv.src) el.rv.src = '';

    app.clip.clear();
    forgetLoaded();
    app.chunks = [];
    app.recAudio = false;

    el.timeline.classList.remove('on');
    el.idleOv.classList.remove('gone');
    el.btnExp.style.display = 'none';
    el.thumbs.innerHTML = '';
    el.resBadge.style.display = 'none';

    setTimerMs(0);
    playback.reset();
    waveform.clear();
    updateSizeUI();
    drawGrid();
  }
}

export const session = new Session();
