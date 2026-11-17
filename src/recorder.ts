// Capture + recording.
//
// The three sources are independent toggles — the screen (a share), the webcam
// and the microphone — and all of them start off. A take needs a picture: the
// screen, or the webcam when the screen is off; the preview always shows
// whichever source is live, so the red button only starts and stops the
// recording. Nothing here reaches for the screen while the Screen button is off.

import { app, setPhase } from './state.js';
import { el, setStatus, toast } from './ui/dom.js';
import { refreshSourceButtons } from './ui/source-buttons.js';
import { drawGrid, startMirror, stopMirror, seekWithin } from './ui/preview.js';
import { countdown } from './ui/countdown.js';
import { strip } from './ui/timeline-ui.js';
import { player } from './ui/clip.js';
import { playback } from './ui/playback.js';
import { waveform } from './ui/waveform.js';
import { FULL, isFullRegion } from './ui/region.js';
import { drawWebcamOverlay } from './ui/webcam.js';
import { liveTimeline } from './ui/live-timeline.js';
import { getBestMime } from './infra/codecs.js';

// A take needs a picture: the screen share, or the webcam when the screen is off.
export function hasPicture(): boolean {
  return (app.screenOn && !!app.stream) || (app.webcamOn && !!app.webcamStream);
}

// A take in flight owns the preview and the phase, so nothing else may move them.
function busy(): boolean {
  return app.phase === 'starting' || app.phase === 'countdown' || app.phase === 'recording' || app.phase === 'encoding';
}

export async function toggleRec(): Promise<void> {
  if (app.phase === 'starting' || app.phase === 'encoding') return;
  if (app.phase === 'countdown') return cancelRecordingCountdown();
  if (app.phase === 'recording') return stopRec();
  if (app.phase === 'live')      return startRecording();
  if (app.phase === 'review') {
    // Recording again adds to the end of what is already there, from whatever
    // source is live — the kept share, or the webcam when the screen is off.
    if (hasPicture()) return startRecording();
    toast('Turn on Screen or Webcam to keep recording', 4000);
    return;
  }
  // Idle: nothing is live, and pressing Record never reaches for the screen on
  // its own — the Screen button is what asks for a share.
  toast('Turn on Screen or Webcam first', 4000);
}

// The Screen source button: on exactly while a share is held (or being asked
// for). Turning it off lets the share go, and the webcam — if it is on — takes
// the preview. Nothing reaches for the screen again until it is turned back on.
export function toggleScreen(): void {
  if (busy()) return;
  if (app.screenOn) {
    app.screenOn = false;
    releaseDisplay();
    syncSources();
    return;
  }
  app.screenOn = true;
  void startCapture(true);
}

// What the preview shows and where the phase belongs, decided in one place after
// any source changes: a share taken or let go, the webcam switched on or off.
// While a clip is being reviewed the preview is the clip's, and a take in flight
// owns it — neither is disturbed.
export function syncSources(): void {
  refreshSourceButtons();
  if (busy() || app.phase === 'review') return;

  if (!hasPicture()) {
    stopMirror();
    drawGrid();
    el.idleOv.classList.remove('gone');
    el.recBtn.disabled = false;
    el.recLbl.textContent = 'Record';
    setPhase('idle');
    setStatus('ready', 'Ready');
    return;
  }

  if (app.screenOn && app.stream) sizePreviewToScreen();
  else useWebcamSize();

  if (!app.mirroring) startMirror();
  el.idleOv.classList.add('gone');
  el.recBtn.disabled = false;
  el.recLbl.textContent = 'Record';
  setPhase('live');
  setStatus('ready', `Live · ${app.captureW}×${app.captureH}`);
}

function sizePreviewToScreen(): void {
  el.cv.width = app.captureW;
  el.cv.height = app.captureH;
  el.resBadge.textContent = `${app.captureW} × ${app.captureH}`;
  el.resBadge.style.display = '';
}

// The webcam is the whole picture when the screen is off, so the preview takes
// the camera's own size rather than the screen's.
function useWebcamSize(): void {
  const w = el.wcv.videoWidth, h = el.wcv.videoHeight;
  if (!w || !h) return;
  app.captureW = w;
  app.captureH = h;
  sizePreviewToScreen();
}

// Pressing record during the countdown aborts it and the pending recording,
// returning to the live preview.
function cancelRecordingCountdown(): void {
  countdown.cancel();
  // Back to whatever was on screen before the countdown: the clip being
  // reviewed, not the live screen (its timeline is only live in 'review').
  const back = countdown.returnsTo;
  setPhase(back);
  el.recBtn.disabled = false;
  el.recLbl.textContent = 'Record';
  if (back === 'review') {
    stopMirror();
    playback.seek(player.time());
    setStatus('ready', 'Ready to export');
  } else {
    setStatus('ready', `Live · ${app.captureW}×${app.captureH}`);
  }
}

// Acquire the display and show it live on the preview. Called on load; also the
// fallback when the browser blocked the gesture-less attempt.
export async function startCapture(force = false): Promise<void> {
  // The screen is not a source right now: nothing here reaches for it.
  if (!app.screenOn) return;
  // Never while a recording is being reviewed or encoded unless it is asked for
  // explicitly: a fresh capture would clobber it. Reset leaves 'review' first.
  if (app.stream || app.phase === 'starting' || app.phase === 'recording') return;
  if (!force && (app.phase === 'review' || app.phase === 'encoding')) return;
  try {
    setPhase('starting');
    el.recBtn.disabled = true;
    setStatus('proc', 'Select screen…');

    // `cursor` and `displaySurface` are display-capture constraints; they are
    // not in lib.dom's MediaTrackConstraints, hence the assertion. Preferring
    // 'monitor' preselects the entire screen in the picker (the browser still
    // asks the user to confirm — a page can never capture silently).
    //
    // Audio is always requested: the browser only offers an audio option at all
    // when `audio` is true. `systemAudio: 'include'` asks for the sound of what
    // is shared as well as the tab's, and it is only a hint — Chrome decides
    // whether the option appears and whether its box starts ticked, and the user
    // still has to agree, so a share without audio is possible and is reported
    // below.
    const video = { frameRate: { ideal: 30, max: 60 }, cursor: 'always', displaySurface: 'monitor' } as MediaTrackConstraints;
    const options = { video, audio: true, systemAudio: 'include' } as unknown as DisplayMediaStreamOptions;
    app.stream = await navigator.mediaDevices.getDisplayMedia(options);

    app.recAudio = app.stream.getAudioTracks().length > 0;
    if (!app.recAudio) toast('No audio was shared — the recording will be silent. Press Reset to share again with audio.', 6000);

    app.region = { ...FULL };   // a fresh capture records the whole source

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
    refreshSourceButtons();
    setPhase('live');
    setStatus('ready', `Live · ${app.captureW}×${app.captureH}`);
  } catch (err) {
    const e = err as { name?: string };
    // No share was had, so the screen is no longer a source: the button goes
    // out, and the webcam keeps the preview if it is on. The phase is left
    // behind first, so syncSources is free to set it.
    app.screenOn = false;
    el.resBadge.style.display = 'none';
    setPhase('idle');
    syncSources();
    if (e.name && e.name !== 'NotAllowedError') toast('Could not start: ' + e.name, 4000);
  }
}

// --- Crop region ---------------------------------------------------------

// The canvas a recording is drawn on when the recording is not simply the shared
// screen: a crop of it, with the webcam bubble over it. The recorder is fed a
// stream captured from this canvas, and the loop below keeps it current frame by
// frame. It belongs to the take — attached when the take is built, started while
// it runs, stopped when it is over — so it lives on one object.
class Output {
  private ctx: CanvasRenderingContext2D | null = null;
  private from = { x: 0, y: 0, w: 0, h: 0 };   // the part of the screen that goes in
  private frame = 0;

  /** The canvas to draw into, and the part of the screen that goes into it. */
  attach(ctx: CanvasRenderingContext2D, from: { x: number; y: number; w: number; h: number }): void {
    this.ctx = ctx;
    this.from = from;
  }

  /** Keep it current while the take runs. */
  start(): void {
    const paint = () => {
      const ctx = this.ctx;
      if (app.phase !== 'recording' || !ctx) return;
      const { x, y, w, h } = this.from;
      ctx.drawImage(el.sv, x, y, w, h, 0, 0, w, h);
      drawWebcamOverlay(ctx, 0, 0, w, h);
      this.frame = requestAnimationFrame(paint);
    };
    paint();
  }

  /** The take is over: nothing more is drawn, and the canvas is let go of. */
  stop(): void {
    if (this.frame) { cancelAnimationFrame(this.frame); this.frame = 0; }
    this.ctx = null;
  }
}

// Both are the module's own objects, as the view modules' are: exported so a
// harness can drive a take's canvas and its audio graph without a screen share.
export const output = new Output();

// The webcam alone is the picture, the screen with a crop or a bubble is drawn
// on a canvas, and a plain full-screen share is recorded raw.
function buildRecordingStream(): MediaStream {
  output.stop();                 // a fresh take: nothing of the last canvas is left
  const audio = buildAudioTracks();

  // No screen share: the camera is the whole picture, at its own size.
  if (!app.screenOn || !app.stream) {
    const out = new MediaStream();
    app.webcamStream?.getVideoTracks().forEach(t => out.addTrack(t));
    audio.forEach(t => out.addTrack(t));
    return out;
  }

  const src = app.stream;
  const region = app.region;
  const needCanvas = !isFullRegion(region) || app.webcamOn;

  if (!needCanvas) {
    if (!app.micOn) return src;                 // raw stream already carries the audio
    const out = new MediaStream();
    src.getVideoTracks().forEach(t => out.addTrack(t));
    audio.forEach(t => out.addTrack(t));
    return out;
  }

  const rx = Math.round(region.x * app.captureW);
  const ry = Math.round(region.y * app.captureH);
  const rw = Math.max(2, Math.round(region.w * app.captureW));
  const rh = Math.max(2, Math.round(region.h * app.captureH));

  const canvas = document.createElement('canvas');
  canvas.width = rw; canvas.height = rh;
  const cctx = canvas.getContext('2d');
  if (!cctx) return src;

  const stream = canvas.captureStream(30);
  audio.forEach(t => stream.addTrack(t));
  output.attach(cctx, { x: rx, y: ry, w: rw, h: rh });
  return stream;
}

// The recording's audio: the capture's system audio, plus the microphone when it
// is on, mixed through a Web Audio graph. Without a mic we pass the raw track.
//
// Tab/system audio (music, a video…) is usually mastered loud, while a mic voice
// is quiet, so the mix trims the system feed and lifts the mic — and compresses
// the mic so the boost can't clip. Tune these two to taste.
const SYSTEM_GAIN = 0.4;
const MIC_GAIN = 3;

// The graph belongs to the take it was built for, so it lives on one object and
// the take that ends closes it.
class Mixer {
  private ctx: AudioContext | null = null;

  /** What a take should record: the system audio, and the mic over it when there is one. */
  mix(system: MediaStreamTrack[], mic: MediaStreamTrack[]): MediaStreamTrack[] {
    if (!mic.length) return system;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;
    const dest = ctx.createMediaStreamDestination();

    if (system.length) {
      const sysGain = ctx.createGain();
      sysGain.gain.value = SYSTEM_GAIN;
      ctx.createMediaStreamSource(new MediaStream(system)).connect(sysGain).connect(dest);
    }

    const micGain = ctx.createGain();
    micGain.gain.value = MIC_GAIN;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    ctx.createMediaStreamSource(new MediaStream(mic)).connect(micGain).connect(comp).connect(dest);

    void ctx.resume();
    return dest.stream.getAudioTracks();
  }

  /** The take is over: the graph goes with it. */
  stop(): void {
    if (this.ctx) { void this.ctx.close(); this.ctx = null; }
  }
}

export const mixer = new Mixer();

function buildAudioTracks(): MediaStreamTrack[] {
  const sys = app.stream ? app.stream.getAudioTracks() : [];
  const mic = app.micOn && app.micStream ? app.micStream.getAudioTracks() : [];
  return mixer.mix(sys, mic);
}

async function startRecording(): Promise<void> {
  if (!hasPicture() || (app.phase !== 'live' && app.phase !== 'review')) return;
  const appending = !app.clip.takes.isEmpty();
  const was = app.phase;               // where a cancelled countdown returns to
  setPhase('countdown');
  el.recBtn.disabled = false;          // stays clickable: a press cancels
  el.recLbl.textContent = 'Cancel';
  setStatus('proc', appending ? 'Get ready to add…' : 'Get ready…');
  if (appending) toast('Recording will be added to the end', 3000);

  // Show what is about to be recorded. When this take follows another one, the
  // preview was showing the clip being reviewed and the live mirror that draws
  // the screen — and the crop box over it — has to come back for the take.
  if (appending) {
    playback.pause();                   // the clip was not being recorded
    el.cv.width  = app.captureW;
    el.cv.height = app.captureH;
    startMirror();
  }
  const ready = await countdown.run(was);

  if (!ready) return;                                     // cancelled by a press
  if (!hasPicture()) {                                    // the source ended meanwhile
    el.recBtn.disabled = false;
    el.recLbl.textContent = 'Record';
    // A finished clip is kept, so land back on it rather than on an empty app.
    const keepClip = !app.clip.takes.isEmpty();
    setPhase(keepClip ? 'review' : 'idle');
    setStatus('ready', keepClip ? 'Ready to export · turn a source on to record again' : 'Ready');
    toast('The source ended — turn one on to record again', 4000);
    return;
  }

  const recStream = buildRecordingStream();
  app.recAudio = recStream.getAudioTracks().length > 0;   // system and/or mic
  const mime = getBestMime(app.recAudio);
  app.rec = new MediaRecorder(recStream, mime ? { mimeType: mime } : {});
  app.chunks = [];
  app.rec.ondataavailable = e => { if (e.data.size > 0) app.chunks.push(e.data); };
  app.rec.onstop = onRecStop;
  app.rec.start(100);

  app.startAt = Date.now();
  setPhase('recording');
  output.start();
  // Show the timeline filling in as the take records.
  liveTimeline.start(recStream);
  el.recBtn.disabled = false;

  el.recBtn.classList.add('recording');
  el.ring3.style.opacity = '1';
  el.ctrl.classList.add('recording');
  el.badge.classList.add('on');
  el.recLbl.textContent = 'Stop';
  setStatus('rec', `REC · ${app.captureW}×${app.captureH}`);
}

export function stopRec(): void {
  if (app.rec && app.rec.state !== 'inactive') app.rec.stop();
  output.stop();
  mixer.stop();
  liveTimeline.stop();         // the review rebuilds the timeline from the file
  // The share is kept: reviewing a clip and then pressing Record again adds to
  // it, which should not cost another trip through the picker.
  stopMirror();
  el.recBtn.classList.remove('recording');
  el.ring3.style.opacity = '0';
  el.ctrl.classList.remove('recording');
  el.badge.classList.remove('on');
  el.recLbl.textContent = 'Record';
  setStatus('proc', 'Processing…');
}

// Let go of the shared screen. It does not decide what the preview shows next:
// the caller syncs the sources, because the webcam may be taking over.
export function releaseDisplay(): void {
  if (!app.stream) return;
  // Detach first, so releasing the tracks doesn't re-enter onCaptureEnded.
  app.stream.getVideoTracks()[0]?.removeEventListener('ended', onCaptureEnded);
  app.stream.getTracks().forEach(t => t.stop());
  app.stream = null;
  el.sv.srcObject = null;
  refreshSourceButtons();
}

// The user clicked the browser's "Stop sharing" chip, or the shared surface went
// away (a closed window, a tab that was closed).
function onCaptureEnded(): void {
  if (app.phase === 'recording') { stopRec(); return; }
  const inReview = app.phase === 'review';
  const counting = app.phase === 'countdown';
  if (!inReview && app.phase !== 'live' && !counting) return;

  if (counting) countdown.cancel();
  app.screenOn = false;      // the share is gone: the screen is no longer a source
  releaseDisplay();
  el.resBadge.style.display = 'none';
  el.recLbl.textContent = 'Record';
  // A finished clip is kept: recording more just needs a source again. The
  // webcam and the microphone are the user's own toggles and are left alone.
  const keepClip = inReview || !app.clip.takes.isEmpty();
  if (keepClip) {
    stopMirror();
    setPhase('review');
    setStatus('ready', 'Ready to export · turn a source on to record again');
    return;
  }
  syncSources();             // the webcam, if it is on, keeps the preview
}

// A recording just finished: keep it as a take, then open the review on the
// whole joined clip. A second recording is added to the end, so the trims made
// before it stay put (only the cuts are re-based, to keep them over
// the same moments of the recording).
async function onRecStop(): Promise<void> {
  const blob = new Blob(app.chunks, { type: 'video/webm' });
  const wallClock = (Date.now() - (app.startAt ?? Date.now())) / 1000;
  const appending = !app.clip.takes.isEmpty();
  const previous = app.clip.total();

  setPhase('review');
  setStatus('ready', 'Ready to export');

  // Measure this take before it joins the others: its length is where the next
  // take will start, and the total drives the whole timeline.
  const duration = (await measureTake(blob)) ?? wallClock;
  // The clip announces the take and everything showing the clip reacts — the marks
  // and the handles do so at once. The strip cannot: it is drawn by seeking the
  // element, which only now starts holding the new take.
  app.clip.addTake(blob, duration);

  playback.reset();
  await player.load(appending ? app.clip.takes.count() - 1 : 0);

  // The clip may be a cropped region, so size the preview canvas to it.
  if (el.rv.videoWidth && el.rv.videoHeight) { el.cv.width = el.rv.videoWidth; el.cv.height = el.rv.videoHeight; }
  void waveform.build(app.clip.takes.all());
  // Building the thumbnails seeks through the clip; once that is done, park the
  // playhead at the trim IN, or at the join when a recording was just added.
  const park = appending ? previous : app.clip.trim.start * app.clip.total();
  void strip.build().then(() => playback.seek(park));
  el.timeline.classList.add('on');
  el.btnExp.style.display   = '';
}

// The real length of a recorded blob, or null if the browser will not say.
async function measureTake(blob: Blob): Promise<number | null> {
  const vid = document.createElement('video');
  vid.preload = 'auto';
  const url = URL.createObjectURL(blob);
  vid.src = url;
  const ok = await new Promise<boolean>(resolve => {
    vid.addEventListener('loadedmetadata', () => resolve(true), { once: true });
    setTimeout(() => resolve(false), 1500);
  });
  const duration = ok ? await resolveDuration(vid) : null;
  URL.revokeObjectURL(url);
  return duration;
}

// The clip's real duration, or null if the browser will not give one.
//
// A MediaRecorder WebM has no duration in its header, so the browser reports
// Infinity and treats the file as an open-ended stream: seeking it is slow and
// can stall outright. Seeking far past the end once makes it parse the whole
// file, after which the duration is known and seeking behaves normally.
export async function resolveDuration(vid: HTMLVideoElement): Promise<number | null> {
  if (isFinite(vid.duration)) return vid.duration > 0.1 ? vid.duration : null;

  const found = await new Promise<number | null>(resolve => {
    let done = false;
    const finish = (value: number | null) => {
      if (done) return;
      done = true;
      vid.removeEventListener('durationchange', onDuration);
      clearTimeout(timer);
      resolve(value);
    };
    const onDuration = () => { if (isFinite(vid.duration) && vid.duration > 0.1) finish(vid.duration); };
    const timer = setTimeout(() => finish(null), 1500);
    vid.addEventListener('durationchange', onDuration);
    vid.currentTime = 1e101;
  });

  await seekWithin(vid, 0, 1500);      // back to the start, ready for the thumbnails
  return found;
}
