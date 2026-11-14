// Screen capture + recording.
//
// The capture is acquired as soon as the app opens (full screen preferred) and
// shown live on the preview, so the red button only starts/stops the recording.
// If the browser requires a user gesture first, the red button falls back to
// acquiring the capture.

import { app, setPhase } from './state.js';
import { el, setStatus, toast } from './ui/dom.js';
import { startMirror, stopMirror, seekAndDraw } from './ui/preview.js';
import { runCountdown } from './ui/countdown.js';
import { startTimer, stopTimer, setTimerMs } from './ui/timer.js';
import { buildThumbs, resetTrim, updateSizeUI } from './ui/timeline-ui.js';
import { resetPlayback } from './ui/playback.js';
import { buildWaveform } from './ui/waveform.js';
import { getBestMime } from './infra/codecs.js';

export async function toggleRec(): Promise<void> {
  if (app.phase === 'starting' || app.phase === 'encoding') return;
  if (app.phase === 'idle')      return startCapture();
  if (app.phase === 'live')      return startRecording();
  if (app.phase === 'recording') return stopRec();
}

// Acquire the display and show it live on the preview. Called on load; also the
// fallback when the browser blocked the gesture-less attempt.
export async function startCapture(): Promise<void> {
  if (app.stream || app.phase === 'starting' || app.phase === 'recording') return;
  try {
    setPhase('starting');
    el.recBtn.disabled = true;
    setStatus('proc', 'Select screen…');

    // `cursor` and `displaySurface` are display-capture constraints; they are
    // not in lib.dom's MediaTrackConstraints, hence the assertion. Preferring
    // 'monitor' preselects the entire screen in the picker (the browser still
    // asks the user to confirm — a page can never capture silently). Audio is
    // always requested: the browser only yields a track when the source has sound.
    const video = { frameRate: { ideal: 30, max: 60 }, cursor: 'always', displaySurface: 'monitor' } as MediaTrackConstraints;
    app.stream = await navigator.mediaDevices.getDisplayMedia({ video, audio: true });

    app.recAudio = app.stream.getAudioTracks().length > 0;
    if (!app.recAudio) toast('No audio was shared — the recording will be silent.', 4000);

    app.stream.getVideoTracks()[0].addEventListener('ended', onCaptureEnded);

    el.sv.srcObject = app.stream;
    await el.sv.play();

    const settings = app.stream.getVideoTracks()[0].getSettings();
    app.captureW = settings.width  || 1280;
    app.captureH = settings.height || 720;
    el.cv.width  = app.captureW;
    el.cv.height = app.captureH;

    el.resBadge.textContent = `${app.captureW} × ${app.captureH}`;
    el.resBadge.style.display = '';

    startMirror();                       // live preview on the canvas
    el.idleOv.classList.add('gone');
    el.recBtn.disabled = false;
    el.recLbl.textContent = 'Record';
    setPhase('live');
    setStatus('ready', `Live · ${app.captureW}×${app.captureH}`);
  } catch (err) {
    const e = err as { name?: string };
    stopMirror();
    el.idleOv.classList.remove('gone');
    el.resBadge.style.display = 'none';
    el.recBtn.disabled = false;
    setPhase('idle');
    setStatus('ready', 'Ready');
    // NotAllowedError just means "cancelled / needs a gesture" — the idle hint
    // already tells the user to press record.
    if (e.name && e.name !== 'NotAllowedError') toast('Could not start: ' + e.name, 4000);
  }
}

async function startRecording(): Promise<void> {
  if (!app.stream || app.phase !== 'live') return;
  el.recBtn.disabled = true;
  setStatus('proc', 'Get ready…');
  await runCountdown();

  if (!app.stream || !app.stream.active) {   // capture ended during the countdown
    el.recBtn.disabled = false;
    return;
  }

  const mime = getBestMime(app.recAudio);
  app.rec = new MediaRecorder(app.stream, mime ? { mimeType: mime } : {});
  app.chunks = [];
  app.rec.ondataavailable = e => { if (e.data.size > 0) app.chunks.push(e.data); };
  app.rec.onstop = onRecStop;
  app.rec.start(100);

  app.startAt = Date.now();
  setPhase('recording');
  el.recBtn.disabled = false;

  el.recBtn.classList.add('recording');
  el.ring3.style.opacity = '1';
  el.ctrl.classList.add('recording');
  el.badge.classList.add('on');
  el.recLbl.textContent = 'Stop';
  setStatus('rec', `REC · ${app.captureW}×${app.captureH}`);
  startTimer();
}

export function stopRec(): void {
  if (app.rec && app.rec.state !== 'inactive') app.rec.stop();
  if (app.stream) {
    // Detach first, so releasing the tracks doesn't re-enter onCaptureEnded.
    app.stream.getVideoTracks()[0]?.removeEventListener('ended', onCaptureEnded);
    app.stream.getTracks().forEach(t => t.stop());
    app.stream = null;
  }
  stopTimer();
  stopMirror();
  el.recBtn.classList.remove('recording');
  el.ring3.style.opacity = '0';
  el.ctrl.classList.remove('recording');
  el.badge.classList.remove('on');
  el.recLbl.textContent = 'Record';
  setStatus('proc', 'Processing…');
}

// The user clicked the browser's "Stop sharing" chip.
function onCaptureEnded(): void {
  if (app.phase === 'recording') { stopRec(); return; }
  if (app.phase !== 'live') return;
  app.stream = null;
  el.sv.srcObject = null;
  stopMirror();
  el.idleOv.classList.remove('gone');
  el.resBadge.style.display = 'none';
  el.recLbl.textContent = 'Record';
  setPhase('idle');
  setStatus('ready', 'Ready');
}

function onRecStop(): void {
  app.blob = new Blob(app.chunks, { type: 'video/webm' });
  const wallClock = (Date.now() - (app.startAt ?? Date.now())) / 1000;
  setPhase('review');
  setStatus('ready', 'Ready to export');

  el.rv.src = URL.createObjectURL(app.blob);
  el.rv.load();
  el.rv.addEventListener('loadeddata', () => {
    // Use actual file duration — wall clock is always slightly longer than the
    // encoded video, which causes exportWebM to hang if we use the wall clock.
    app.duration = (isFinite(el.rv.duration) && el.rv.duration > 0.1) ? el.rv.duration : wallClock;
    resetPlayback();
    void buildWaveform(app.blob);
    void buildThumbs();
    void seekAndDraw(el.rv, 0);
    setTimerMs(app.duration * 1000);
    resetTrim();
    el.timeline.classList.add('on');
    el.btnReset.style.display = '';
    el.btnExp.style.display   = '';
    updateSizeUI();
  }, { once: true });
}
