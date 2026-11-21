// The export flow: the Export button, the status line and the phase.
//
// It sequences the browser work and reports the outcome. What to write and how to
// encode it belong to the export use case and the encoder adapter.

import { currentPhase, setPhase } from '../../state.js';
import { session } from '../../session.js';
import { ExportVideo } from '../../application/export-video.js';
import { encoder } from '../../infra/offline-encoder.js';
import { downloadPort } from '../../infra/download.js';
import { clock } from '../../infra/clock.js';
import { images } from '../../infra/images.js';
import { frameRenderer } from './frame-renderer.js';
import { el, setStatus, toast } from '../dom.js';
import { beginEncoding, endEncoding, encodingAt } from '../clip/timeline-ui.js';
import { playback } from '../clip/playback.js';
import { keep } from '../keeping/keep.js';
import { FADE_S } from '../clip/fade.js';
import type { ExportTarget } from '../../domain/export/ExportTarget.js';

const exportVideo = new ExportVideo({
  clip: session.clip,
  encoder,
  renderer: frameRenderer,
  download: downloadPort,
  clock,
  audio: () => session.audio,
  fadeSeconds: FADE_S,
});

/**
 * What an export came to. The buttons only toast it; the automation surface answers
 * with it, so an agent can be told what happened rather than guessing from a toast.
 */
export type ExportResult =
  | { kind: 'exported'; bytes: number; filename: string }
  | { kind: 'refused'; reason: string }
  | { kind: 'failed'; reason: string };

export async function doExport(target: ExportTarget = 'webm'): Promise<ExportResult> {
  if (currentPhase() !== 'review') {
    return { kind: 'refused', reason: 'the clip is not in the review, so there is nothing to export' };
  }
  playback.pause();
  setPhase('encoding');
  el.recBtn.disabled = true;
  el.btnExp.disabled = true;
  el.btnNew.disabled = true;
  el.playBtn.disabled = true;
  setStatus('proc', 'Encoding…');
  const wasCut = beginEncoding();
  // The export draws frames in a tight loop, so it waits once, here, for every picture
  // an image annotation needs to be decoded. A picture not decoded draws nothing.
  await images.ready();
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

  if (outcome.kind === 'exported') {
    return { kind: 'exported', bytes: outcome.stats.bytes, filename: outcome.filename };
  }
  return { kind: outcome.kind, reason: outcome.reason };
}
