// Export and reset use cases: write the trimmed clip to WebM, and tear the
// session down again.
//
// The export is encoded offline by src/offline-export.ts: nothing plays, so it
// runs faster than real time and keeps going with the tab in the background.
//
// There used to be a second, real-time export that played the clip through a
// canvas and recorded that with MediaRecorder. It was only reachable on browsers
// without WebCodecs — Firefox below 130 — which is not a browser we expect to see,
// so it was removed rather than carried. `git log -- src/exporter.ts` has it, and
// POC-offline-export.md on the poc/offline-export branch measured the two.

import { app, setPhase } from './state.js';
import { el, setStatus, toast } from './ui/dom.js';
import { drawGrid } from './ui/preview.js';
import { setTimerMs } from './ui/timer.js';
import { beginEncoding, encodingAt, endEncoding, resetTrim, updateSizeUI } from './ui/timeline-ui.js';
import { resetMarks } from './ui/marks.js';
import { forgetLoaded } from './ui/clip.js';
import { dlBlob, ts } from './infra/download.js';
import { stopRec, startCapture, releaseDisplay } from './recorder.js';
import { pausePlayback, resetPlayback } from './ui/playback.js';
import { clearWaveform } from './ui/waveform.js';
import { exportOffline, offlineAvailable, type OfflineStats } from './offline-export.js';

// The offline export writes the whole file itself, so there is nothing to feed a
// recorder and nothing to play: it reports how far it has got as it goes, and
// hands back what it managed so the caller can say it.
async function exportOfflineHere(): Promise<OfflineStats> {
  const end = Math.min(app.trimEnd * app.duration, app.duration - 0.05);
  const { blob, stats } = await exportOffline(source => encodingAt(source, end));
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

  setPhase('idle');
  if (el.rv.src) { URL.revokeObjectURL(el.rv.src); el.rv.src = ''; }
  app.takes.clear(); forgetLoaded(); app.chunks = []; app.duration = 0; app.recAudio = false;
  el.timeline.classList.remove('on');
  el.idleOv.classList.remove('gone');
  el.btnExp.style.display   = 'none';
  el.thumbs.innerHTML       = '';
  el.resBadge.style.display = 'none';
  setTimerMs(0);
  resetPlayback();
  clearWaveform();
  resetMarks();
  resetTrim();
  updateSizeUI();
  drawGrid();
  setStatus('ready', 'Ready');
  // Same as the app start: go straight back to a live capture. Reset is a click,
  // so the gesture is available for getDisplayMedia.
  void startCapture();
}
