// The export and reset flows: wrap the use cases in the buttons, the status line
// and the phase they belong to.
//
// What the export should write is decided by src/application/export-clip.ts and
// encoded by src/offline-export.ts, which between them need nothing from here.
// What is left is the flow: refusing early where WebCodecs is missing, disabling
// the controls, and saying how it went.
//
// The export is encoded offline: nothing plays, so it runs faster than real time
// and keeps going with the tab in the background.
//
// There used to be a second, real-time export that played the clip through a
// canvas and recorded that with MediaRecorder. It was only reachable on browsers
// without WebCodecs — Firefox below 130 — which is not a browser we expect to see,
// so it was removed rather than carried. `git log -- src/exporter.ts` has it, and
// POC-offline-export.md on the poc/offline-export branch measured the two.

import { app, setPhase } from './state.js';
import { el, setStatus, toast } from './ui/dom.js';
import { beginEncoding, encodingAt, endEncoding } from './ui/timeline-ui.js';
import { dlBlob, ts } from './infra/download.js';
import { stopRec, startCapture, releaseDisplay } from './recorder.js';
import { pausePlayback } from './ui/playback.js';
import { session } from './session.js';
import { exportOffline, offlineAvailable, type OfflineStats } from './offline-export.js';
import { planExport } from './application/export-clip.js';
import { FADE_S } from './ui/fade.js';

// The offline export writes the whole file itself, so there is nothing to feed a
// recorder and nothing to play: it reports how far it has got as it goes, and
// hands back what it managed so the caller can say it.
async function exportOfflineHere(): Promise<OfflineStats> {
  const plan = planExport(app.clip, { audio: app.recAudio, fadeSeconds: FADE_S });
  // Nothing to write is the same error the encoder used to raise, on the same path.
  if (!plan) throw new Error('nothing to export');
  const { blob, stats } = await exportOffline(plan, source => encodingAt(source, plan.to));
  dlBlob(blob, 'demoshine-' + ts() + '.webm');
  console.info('DemoShine export', stats);
  return stats;
}

export async function doExport(): Promise<void> {
  if (app.phase !== 'review') return;
  // The export is WebCodecs, and now there is nothing behind it: say so plainly
  // rather than fail halfway through with an empty download.
  if (!offlineAvailable()) {
    setStatus('ready', 'Cannot encode here');
    toast('This browser cannot write WebM — it needs Chrome 94+ or Firefox 130+.', 6000);
    return;
  }
  pausePlayback();
  setPhase('encoding');
  el.recBtn.disabled   = true;
  el.btnExp.disabled   = true;
  el.btnReset.disabled = true;
  el.playBtn.disabled  = true;
  setStatus('proc', 'Encoding…');
  beginEncoding();
  try {
    const stats = await exportOfflineHere();
    setStatus('ready', 'Export complete ✓');
    toast(`File downloaded successfully — written at ${stats.realtime.toFixed(1)}× real time.`, 4000);
  } catch (err) {
    console.error(err);
    setStatus('ready', 'Export failed');
    toast('Export error: ' + (err as Error).message, 4000);
  }
  setPhase('review');
  el.recBtn.disabled   = false;
  el.btnExp.disabled   = false;
  el.btnReset.disabled = false;
  el.playBtn.disabled  = false;
  endEncoding();
  pausePlayback();               // refresh the playhead after the export moved rv
}

export function resetAll(): void {
  if (app.phase === 'recording') { stopRec(); return; }
  if (app.phase === 'encoding' || app.phase === 'starting') return;

  // A live share has to be let go of before another can be asked for — that is
  // the point of resetting while waiting to record, where the reason to reset is
  // usually to go back and tick "share audio".
  releaseDisplay();

  // The session lets go of everything it holds — the clip, the timeline, the
  // playhead, the strip — and the flow around it goes on being the flow: the
  // phase, the status line, and going back for a screen.
  setPhase('idle');
  session.reset();
  setStatus('ready', 'Ready');
  // Same as the app start: go straight back to a live capture. Reset is a click,
  // so the gesture is available for getDisplayMedia.
  void startCapture();
}
