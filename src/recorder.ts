// Recording use case: pick a display, count down, record, and hand the result
// to the review phase.

import { app, setPhase } from './state.js';
import { el, setStatus, toast } from './ui/dom.js';
import { startMirror, stopMirror, seekAndDraw } from './ui/preview.js';
import { runCountdown } from './ui/countdown.js';
import { startTimer, stopTimer, setTimerMs } from './ui/timer.js';
import { buildThumbs, resetTrim, updateSizeUI, checkGifWarning } from './ui/timeline-ui.js';
import { resetPlayback } from './ui/playback.js';
import { buildWaveform } from './ui/waveform.js';
import { getBestMime } from './infra/codecs.js';

export async function toggleRec(): Promise<void> {
  if (app.phase === 'starting' || app.phase === 'encoding') return;
  if (app.phase === 'idle')      return startRec();
  if (app.phase === 'recording') return stopRec();
}

export async function startRec(): Promise<void> {
  try {
    setPhase('starting');
    el.recBtn.disabled = true;
    setStatus('proc', 'Select display…');

    const audioEnabled = el.audioChk.checked && app.fmt === 'webm';
    // `cursor` is a display-capture constraint; it is not in lib.dom's
    // MediaTrackConstraints, hence the assertion.
    const video = { frameRate: { ideal: 30, max: 60 }, cursor: 'always' } as MediaTrackConstraints;
    app.stream = await navigator.mediaDevices.getDisplayMedia({ video, audio: audioEnabled });

    // getDisplayMedia only yields an audio track if the user ticked "share audio".
    app.recAudio = audioEnabled && app.stream.getAudioTracks().length > 0;
    if (audioEnabled && !app.recAudio) {
      toast('No audio track was shared — the recording will be silent.', 4000);
    }

    let cancelled = false;
    app.stream.getVideoTracks()[0].addEventListener('ended', () => {
      if (app.phase === 'recording') stopRec();
      else cancelled = true;
    });

    el.sv.srcObject = app.stream;
    await el.sv.play();

    const settings = app.stream.getVideoTracks()[0].getSettings();
    app.captureW = settings.width  || 1280;
    app.captureH = settings.height || 720;
    el.cv.width  = app.captureW;
    el.cv.height = app.captureH;

    el.resBadge.textContent = `${app.captureW} × ${app.captureH}`;
    el.resBadge.style.display = '';

    // Start mirroring — user sees their screen during countdown.
    startMirror();
    el.idleOv.classList.add('gone');
    setStatus('proc', 'Get ready…');
    await runCountdown();

    // Guard: stream may have ended during countdown.
    if (cancelled || !app.stream || !app.stream.active) {
      stopMirror();
      el.idleOv.classList.remove('gone');
      el.resBadge.style.display = 'none';
      el.recBtn.disabled = false;
      setPhase('idle');
      setStatus('ready', 'Ready');
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
  } catch (err) {
    const e = err as { name?: string; message?: string };
    stopMirror();
    el.cdOv.style.display = 'none';
    el.idleOv.classList.remove('gone');
    el.resBadge.style.display = 'none';
    el.recBtn.disabled = false;
    setPhase('idle');
    setStatus('ready', 'Ready');
    if (e.name !== 'NotAllowedError') toast('Could not start: ' + e.message, 4000);
  }
}

export function stopRec(): void {
  if (app.rec && app.rec.state !== 'inactive') app.rec.stop();
  if (app.stream) { app.stream.getTracks().forEach(t => t.stop()); app.stream = null; }
  stopTimer();
  stopMirror();
  el.recBtn.classList.remove('recording');
  el.ring3.style.opacity = '0';
  el.ctrl.classList.remove('recording');
  el.badge.classList.remove('on');
  el.recLbl.textContent = 'Record';
  setStatus('proc', 'Processing…');
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
    checkGifWarning();
  }, { once: true });
}
