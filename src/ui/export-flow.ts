// The export flow: the Export button, the status line and the phase.
//
// It sequences the browser work and reports the outcome. What to write and how to
// encode it belong to the export use case and the encoder adapter.

import { currentPhase, setPhase } from '../state.js';
import { session } from '../session.js';
import { ExportVideo } from '../application/export-video.js';
import { encoder } from '../infra/offline-encoder.js';
import { downloadPort } from '../infra/download.js';
import { clock } from '../infra/clock.js';
import { frameRenderer } from './frame-renderer.js';
import { el, setStatus, toast } from './dom.js';
import { beginEncoding, endEncoding, encodingAt } from './timeline-ui.js';
import { playback } from './playback.js';
import { keep } from './keep.js';
import { FADE_S } from './fade.js';
import type { ExportTarget } from '../domain/export/ExportTarget.js';

const exportVideo = new ExportVideo({
  clip: session.clip,
  encoder,
  renderer: frameRenderer,
  download: downloadPort,
  clock,
  audio: () => session.audio,
  fadeSeconds: FADE_S,
});

export async function doExport(target: ExportTarget = 'webm'): Promise<void> {
  if (currentPhase() !== 'review') return;
  playback.pause();
  setPhase('encoding');
  el.recBtn.disabled = true;
  el.btnExp.disabled = true;
  el.btnNew.disabled = true;
  el.playBtn.disabled = true;
  setStatus('proc', 'Encoding…');
  const wasCut = beginEncoding();
  const outcome = await exportVideo.run(target, source => encodingAt(source, session.clip.total()));
  if (outcome.kind === 'exported') {
    keep.forget();
    setStatus('ready', 'Export complete');
    toast(`Saved ${Math.round(outcome.stats.bytes / 1024)} KB`);
  } else if (outcome.kind === 'refused') {
    setStatus('ready', 'Cannot encode here');
    toast(outcome.reason);
  } else {
    setStatus('ready', 'Export failed');
    toast(outcome.reason);
  }
  setPhase('review');
  el.recBtn.disabled = false;
  el.btnExp.disabled = false;
  el.btnNew.disabled = false;
  el.playBtn.disabled = false;
  endEncoding(wasCut);
  playback.pause();
}
