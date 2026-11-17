// The export and new-session flows: wrap the use cases in the buttons, the status
// line and the phase they belong to.
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
import { stopRec, startCapture, releaseDisplay, syncSources } from './recorder.js';
import { playback } from './ui/playback.js';
import { session } from './session.js';
import { forgetClip } from './resume.js';
import { exportOffline, offlineAvailable, type OfflineStats } from './offline-export.js';
import { planExport } from './application/export-clip.js';
import { FADE_S } from './ui/fade.js';
import type { ExportTarget } from './infra/export-target.js';

// The offline export writes the whole file itself, so there is nothing to feed a
// recorder and nothing to play: it reports how far it has got as it goes, and
// hands back what it managed so the caller can say it.
async function exportOfflineHere(target: ExportTarget): Promise<OfflineStats> {
  const plan = planExport(app.clip, { audio: app.recAudio, fadeSeconds: FADE_S });
  // Nothing to write is the same error the encoder used to raise, on the same path.
  if (!plan) throw new Error('nothing to export');
  const { blob, stats } = await exportOffline(plan, { target, onProgress: source => encodingAt(source, plan.to) });
  dlBlob(blob, `demoshine-${ts()}.${target}`);
  console.info('DemoShine export', stats);
  return stats;
}

// The download keeps the WebM; the Bluesky path writes the MP4 it takes. Until
// the publish use case is wired to the menu, that one saves the file so it can be
// watched, and says so, rather than pretending it was posted.
export async function doExport(target: ExportTarget = 'webm'): Promise<void> {
  if (app.phase !== 'review') return;
  // The export is WebCodecs, and now there is nothing behind it: say so plainly
  // rather than fail halfway through with an empty download.
  if (!offlineAvailable()) {
    setStatus('ready', 'Cannot encode here');
    toast('This browser cannot write video — it needs Chrome 94+ or Firefox 130+.', 6000);
    return;
  }
  playback.pause();
  setPhase('encoding');
  el.recBtn.disabled   = true;
  el.btnExp.disabled   = true;
  el.btnNew.disabled   = true;
  el.playBtn.disabled  = true;
  setStatus('proc', 'Encoding…');
  const wasCut = beginEncoding();   // what the chip said before the export took it over
  try {
    const stats = await exportOfflineHere(target);
    // The file is written, so the clip has gone somewhere and the session is
    // over: the copy kept for a reload goes with it.
    forgetClip();
    setStatus('ready', 'Export complete ✓');
    toast(exportedMessage(target, stats), 5000);
  } catch (err) {
    console.error(err);
    setStatus('ready', 'Export failed');
    toast('Export error: ' + (err as Error).message, 4000);
  }
  setPhase('review');
  el.recBtn.disabled   = false;
  el.btnExp.disabled   = false;
  el.btnNew.disabled   = false;
  el.playBtn.disabled  = false;
  endEncoding(wasCut);
  playback.pause();               // refresh the playhead after the export moved rv
}

function exportedMessage(target: ExportTarget, stats: OfflineStats): string {
  const written = `written at ${stats.realtime.toFixed(1)}× real time`;
  return target === 'mp4'
    ? `MP4 saved (${written}) — this is the file Bluesky takes. Publishing comes next.`
    : `File downloaded successfully — ${written}.`;
}

export function startNewSession(): void {
  if (app.phase === 'recording') { stopRec(); return; }
  if (app.phase === 'encoding' || app.phase === 'starting') return;

  // A live share has to be let go of before another can be asked for — that is
  // the point of starting over while waiting to record, where the reason is
  // usually to go back and tick "share audio".
  releaseDisplay();

  // The session lets go of everything it holds — the clip, the timeline, the
  // playhead, the strip, and the copy kept for a reload — and the flow around it
  // goes on being the flow: the phase, the status line, and going back for a
  // screen.
  setPhase('idle');
  session.reset();
  setStatus('ready', 'Ready');
  // Same as the app start: go back for a share — but only while the screen is a
  // source. With it off, the webcam (if it is on) keeps the preview and nothing
  // reaches for the screen.
  if (app.screenOn) void startCapture();
  else syncSources();
}
