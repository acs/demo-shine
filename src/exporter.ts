// Export and reset use cases: re-encode the trimmed clip to WebM or GIF, and
// tear the session down again.

import { app, setPhase } from './state.js';
import { el, setStatus, toast } from './ui/dom.js';
import { seekTo, drawGrid } from './ui/preview.js';
import { setTimerMs } from './ui/timer.js';
import { checkGifWarning, resetTrim, updateSizeUI } from './ui/timeline-ui.js';
import { getBestMime } from './infra/codecs.js';
import { dlBlob, ts } from './infra/download.js';
import { stopRec } from './recorder.js';
import { pausePlayback, resetPlayback } from './ui/playback.js';

export async function doExport(): Promise<void> {
  if (app.phase !== 'review') return;
  pausePlayback();
  setPhase('encoding');
  el.recBtn.disabled   = true;
  el.btnExp.disabled   = true;
  el.btnReset.disabled = true;
  el.playBtn.disabled  = true;
  setStatus('proc', 'Encoding…');
  try {
    if (app.fmt === 'webm') await exportWebM();
    else                    await exportGIF();
    setStatus('ready', 'Export complete ✓');
    toast('File downloaded successfully.', 3000);
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
  el.encBar.style.width = '0%';
  pausePlayback();               // refresh the playhead after the export moved rv
  checkGifWarning();
}

/* Feed the review clip's audio into the export recorder.
   The export canvas is drawn from the silent <video> element, so without this
   the re-encoded WebM would have a video track only. */
function attachExportAudio(stream: MediaStream): void {
  let tracks: MediaStreamTrack[] = [];
  try {
    if (!app.audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        app.audioCtx  = new Ctx();
        const src = app.audioCtx.createMediaElementSource(el.rv);
        app.audioDest = app.audioCtx.createMediaStreamDestination();
        src.connect(app.audioDest);
        src.connect(app.audioCtx.destination); // keep the review clip audible
        // Autoplay policy can leave the context suspended; resume on replay.
        el.rv.addEventListener('play', () => {
          if (app.audioCtx && app.audioCtx.state === 'suspended') app.audioCtx.resume().catch(() => {});
        });
      }
    }
    if (app.audioCtx && app.audioCtx.state === 'suspended') app.audioCtx.resume().catch(() => {});
    if (app.audioDest) tracks = app.audioDest.stream.getAudioTracks();
  } catch (err) {
    console.warn('Orbit: Web Audio passthrough failed —', err);
    app.audioCtx = null; app.audioDest = null; tracks = [];
  }
  // Fallback: pull the audio track straight from the media element.
  if (!tracks.length && typeof el.rv.captureStream === 'function') {
    try { tracks = el.rv.captureStream().getAudioTracks(); } catch { /* element capture unsupported */ }
  }
  tracks.forEach(t => stream.addTrack(t));
}

function exportWebM(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Clamp end point to actual video duration — wall-clock duration is always
    // slightly longer than the encoded file, which was causing an infinite loop.
    const vDur    = (isFinite(el.rv.duration) && el.rv.duration > 0) ? el.rv.duration : app.duration;
    const s       = app.trimStart * app.duration;
    const e       = Math.min(app.trimEnd * app.duration, vDur - 0.05);
    const clipDur = Math.max(e - s, 0.1);

    const ec = document.createElement('canvas');
    ec.width = el.cv.width; ec.height = el.cv.height;
    const ectx = ec.getContext('2d');

    // A canvas captureStream() carries video only. When the recording has
    // audio, mix the review clip's soundtrack into the same stream so the
    // exported WebM is not silent.
    const stream = ec.captureStream(30);
    if (app.recAudio) attachExportAudio(stream);

    const mime = getBestMime(app.recAudio);
    const rec  = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
    const out: Blob[] = [];

    const finish = () => {
      el.rv.pause();
      if (rec.state !== 'inactive') rec.stop();
      el.encBar.style.width = '100%';
    };

    rec.ondataavailable = ev => { if (ev.data.size > 0) out.push(ev.data); };
    rec.onstop = () => { dlBlob(new Blob(out, { type: 'video/webm' }), 'orbit-' + ts() + '.webm'); resolve(); };
    rec.onerror = reject;
    rec.start(100);

    seekTo(el.rv, s).then(() => {
      function frame() {
        if (el.rv.currentTime >= e || el.rv.ended || el.rv.paused) { finish(); return; }
        ectx?.drawImage(el.rv, 0, 0, ec.width, ec.height);
        el.encBar.style.width = Math.min(((el.rv.currentTime - s) / clipDur) * 100, 99).toFixed(1) + '%';
        requestAnimationFrame(frame);
      }
      // Add listeners BEFORE play() to avoid race condition
      el.rv.addEventListener('playing', frame, { once: true });
      el.rv.addEventListener('ended', finish, { once: true });
      el.rv.play().catch(reject);
    }).catch(reject);
  });
}

async function exportGIF(): Promise<void> {
  if (typeof GIF === 'undefined') throw new Error('gif.js not loaded — check your connection.');
  const fps     = parseInt(el.gFps.value);
  const quality = parseInt(el.gQual.value);
  const vDur    = (isFinite(el.rv.duration) && el.rv.duration > 0) ? el.rv.duration : app.duration;
  const s       = app.trimStart * app.duration;
  const e       = Math.min(app.trimEnd * app.duration, vDur - 0.05);
  const clipDur = Math.max(e - s, 0.1);
  const total   = Math.max(1, Math.floor(clipDur * fps));
  const delay   = Math.round(1000 / fps);
  const gW      = Math.round(Math.min(el.cv.width, 960));
  const gH      = Math.round(el.cv.height * (gW / el.cv.width));
  const gif = new GIF({ workers: 2, quality, width: gW, height: gH, workerScript: 'https://unpkg.com/gif.js@0.2.0/dist/gif.worker.js' });
  const fc  = document.createElement('canvas');
  fc.width  = gW; fc.height = gH;
  const fctx = fc.getContext('2d');

  const finished = new Promise<void>((resolve, reject) => {
    gif.on('finished', (b: Blob) => { dlBlob(b, 'orbit-' + ts() + '.gif'); resolve(); });
    gif.on('progress',  (p: number) => { el.encBar.style.width = (50 + p * 50).toFixed(1) + '%'; });
    gif.on('error', reject);
  });

  for (let i = 0; i < total; i++) {
    el.encBar.style.width = ((i / total) * 50).toFixed(1) + '%';
    // Clamp to actual video duration to avoid seeked event never firing
    const seekT = Math.min(s + (i / fps), vDur - 0.05);
    await seekTo(el.rv, seekT);
    fctx?.drawImage(el.rv, 0, 0, gW, gH);
    gif.addFrame(fc, { copy: true, delay });
  }
  gif.render();
  await finished;
}

export function resetAll(): void {
  if (app.phase === 'recording') { stopRec(); return; }
  if (app.phase === 'encoding' || app.phase === 'starting') return;
  setPhase('idle');
  if (el.rv.src) { URL.revokeObjectURL(el.rv.src); el.rv.src = ''; }
  app.blob = null; app.chunks = []; app.duration = 0; app.recAudio = false;
  el.timeline.classList.remove('on');
  el.idleOv.classList.remove('gone');
  el.btnReset.style.display = 'none';
  el.btnExp.style.display   = 'none';
  el.encBar.style.width     = '0%';
  el.thumbs.innerHTML       = '';
  el.resBadge.style.display = 'none';
  el.gifWarn.style.display  = 'none';
  el.btnExp.classList.add('export');
  el.btnExp.classList.remove('warn-export');
  setTimerMs(0);
  resetPlayback();
  resetTrim();
  updateSizeUI();
  drawGrid();
  setStatus('ready', 'Ready');
}
