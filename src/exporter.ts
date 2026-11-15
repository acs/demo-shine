// Export and reset use cases: re-encode the trimmed clip to WebM, and tear the
// session down again.

import { app, setPhase } from './state.js';
import { el, setStatus, toast } from './ui/dom.js';
import { drawGrid } from './ui/preview.js';
import { setTimerMs } from './ui/timer.js';
import { resetTrim, updateSizeUI } from './ui/timeline-ui.js';
import { resetMarks } from './ui/marks.js';
import { clipSeek, clipTime, releaseParts } from './ui/clip.js';
import { getBestMime } from './infra/codecs.js';
import { dlBlob, ts } from './infra/download.js';
import { stopRec, startCapture, releaseDisplay } from './recorder.js';
import { pausePlayback, resetPlayback } from './ui/playback.js';
import { clearWaveform } from './ui/waveform.js';
import { cutEndAt, cutsInSeconds, keptLength, partAt, partStart, spanLength } from './domain/timeline.js';

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
    await exportWebM();
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
    console.warn('DemoShine: Web Audio passthrough failed —', err);
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
    const s       = app.trimStart * app.duration;
    // Clamp the end to the clip itself — a measured total, so this is exact.
    const e       = Math.min(app.trimEnd * app.duration, app.duration - 0.05);
    // Cuts (regions trimmed away) are skipped below, so they must not count
    // towards the progress bar or the clip length.
    const cuts    = cutsInSeconds(app.cuts, app.duration);
    const keptDur = Math.max(keptLength(cuts, s, e), 0.1);

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
    rec.onstop = () => { dlBlob(new Blob(out, { type: 'video/webm' }), 'demoshine-' + ts() + '.webm'); resolve(); };
    rec.onerror = reject;
    rec.start(100);

    // Draw the kept range into the recorder. It may span several recordings, so
    // they are played one after another into the same recorder: the file that
    // comes out is one clip, however many presses of Record it took.
    function drawTo(limit: number): Promise<void> {
      return new Promise(done => {
        let asked = 0;          // cut end already seeked to, so it is asked for once
        let stuckAt = 0;        // when the playhead last failed to get out of a cut
        (function frame() {
          const t = clipTime();
          if (t >= limit - 0.01 || el.rv.ended || el.rv.paused) { done(); return; }
          const cutEnd = cutEndAt(cuts, t);
          if (cutEnd !== null) {
            // Trimmed away: jump past it, without pausing, so the capture and its
            // audio carry straight on. If the element will not come out of the
            // cut, move on rather than record the whole trimmed region.
            const to = Math.min(cutEnd, e);
            if (!el.rv.seeking && asked !== to) { asked = to; void clipSeek(to); }
            if (!stuckAt) stuckAt = Date.now();
            if (Date.now() - stuckAt > 5000) { done(); return; }
            requestAnimationFrame(frame);
            return;
          }
          asked = 0; stuckAt = 0;
          ectx?.drawImage(el.rv, 0, 0, ec.width, ec.height);
          const removed = spanLength(cuts, s, t);
          el.encBar.style.width = Math.min(((t - s - removed) / keptDur) * 100, 99).toFixed(1) + '%';
          requestAnimationFrame(frame);
        })();
      });
    }

    void (async () => {
      let at = s;
      while (at < e - 0.01) {
        const index = partAt(app.parts, at);
        const limit = Math.min(partStart(app.parts, index) + app.parts[index].duration, e);
        await clipSeek(at);
        await el.rv.play().catch(err => { throw err; });
        await drawTo(limit);
        at = limit;
      }
      finish();
    })().catch(reject);
  });
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
  releaseParts();
  app.parts = []; app.chunks = []; app.duration = 0; app.recAudio = false;
  el.timeline.classList.remove('on');
  el.idleOv.classList.remove('gone');
  el.btnExp.style.display   = 'none';
  el.encBar.style.width     = '0%';
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
