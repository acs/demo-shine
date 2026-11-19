// The record flow: the source buttons, the Record button and the preview.
//
// It sequences the browser work and reports the outcome. The rule — a take needs a
// picture, the sources are independent — lives in the record use case and the
// domain value objects.

import { currentPhase, setPhase } from '../state.js';
import { session } from '../session.js';
import { capture, webcamPort, microphonePort } from '../infra/capture.js';
import { compositor } from '../infra/compositor.js';
import { takeRecorder } from '../infra/take-recorder.js';
import { takeProbe } from '../infra/take-probe.js';
import { clock } from '../infra/clock.js';
import { RecordTake } from '../application/record-take.js';
import { el, setStatus, toast } from './dom.js';
import { refreshSourceButtons } from './source-buttons.js';
import { drawGrid, startMirror, stopMirror } from './preview.js';
import { drawWebcamOverlay } from './webcam.js';
import { liveTimeline } from './live-timeline.js';
import { openReview } from './review-flow.js';

const record = new RecordTake({
  clip: session.clip,
  capture,
  webcam: webcamPort,
  mic: microphonePort,
  compositor,
  recorder: takeRecorder,
  probe: takeProbe,
  clock,
  sources: () => capture.sources,
  region: () => capture.region,
  drawBubble: context => drawWebcamOverlay(context, 0, 0, context.canvas.width, context.canvas.height),
  setAudio: audio => { session.audio = audio; },
});

function busy(): boolean {
  const phase = currentPhase();
  return phase === 'starting' || phase === 'recording' || phase === 'encoding';
}

export function hasPicture(): boolean {
  return capture.sources.screen || capture.sources.webcam;
}

export function syncSources(): void {
  refreshSourceButtons();
  if (busy() || currentPhase() === 'review') return;
  if (!hasPicture()) {
    stopMirror();
    drawGrid();
    el.resBadge.classList.remove('on');
    el.idleOv.classList.remove('gone');
    el.recBtn.disabled = false;
    el.recLbl.textContent = 'Record';
    setPhase('idle');
    setStatus('ready', '');
    return;
  }
  sizePreview();
  startMirror();
  el.idleOv.classList.add('gone');
  el.recBtn.disabled = false;
  el.recLbl.textContent = 'Record';
  setPhase('live');
  setStatus('ready', `Live — ${capture.width}×${capture.height}`);
}

function sizePreview(): void {
  el.cv.width = capture.width || 1280;
  el.cv.height = capture.height || 720;
  el.resBadge.classList.add('on');
  el.resBadge.textContent = `${el.cv.width}×${el.cv.height}`;
}

export async function toggleScreen(): Promise<void> {
  if (busy()) return;
  if (capture.sources.screen) {
    capture.stop();
    el.sv.srcObject = null;
    refreshSourceButtons();
    syncSources();
    return;
  }
  setPhase('starting');
  setStatus('ready', 'Select a screen…');
  try {
    const captureSession = await capture.start();
    el.sv.srcObject = captureSession.stream;
    await el.sv.play();
    refreshSourceButtons();
    syncSources();
  } catch (error) {
    setPhase('idle');
    setStatus('ready', '');
    refreshSourceButtons();
    const name = error instanceof Error ? error.name : '';
    if (name !== 'AbortError') toast('The screen could not be shared');
  }
}

export async function toggleRecord(): Promise<void> {
  const phase = currentPhase();
  if (phase === 'starting' || phase === 'encoding') return;
  if (phase === 'recording') { await stopRecording(); return; }
  if (phase === 'live' || phase === 'review') { await startRecording(); return; }
  toast('Turn on the screen or the webcam first');
}

async function startRecording(): Promise<void> {
  const outcome = record.start();
  if (outcome.kind === 'refused') { toast(outcome.reason); return; }
  setPhase('recording');
  el.recBtn.classList.add('recording');
  el.recLbl.textContent = 'Stop';
  el.badge.classList.add('on');
  setStatus('rec', 'Recording');
  if (outcome.kind === 'started') liveTimeline.start(outcome.stream);
  startMirror();
}

export async function stopRecording(): Promise<void> {
  liveTimeline.stop();
  const outcome = await record.stop();
  setPhase('review');
  el.recBtn.classList.remove('recording');
  el.recLbl.textContent = 'Record';
  el.badge.classList.remove('on');
  if (outcome.kind === 'stopped') {
    const index = session.clip.takes.count() - 1;
    await openReview(index, 0);
    setStatus('ready', 'Ready');
  }
}

export function onScreenEnded(): void {
  if (currentPhase() === 'recording') { void stopRecording(); return; }
  // A finished clip is kept: recording more just needs a source again. The webcam
  // and the microphone are the user's own toggles and are left alone.
  const keepClip = currentPhase() === 'review' || !session.clip.takes.isEmpty();
  if (keepClip) {
    stopMirror();
    refreshSourceButtons();
    setPhase('review');
    setStatus('ready', 'Ready to export · turn a source on to record again');
    return;
  }
  syncSources();             // the webcam, if it is on, keeps the preview
}
