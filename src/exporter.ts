// Export and reset use cases: re-encode the trimmed clip to WebM, and tear the
// session down again.

import { app, setPhase } from './state.js';
import { el, setStatus, toast } from './ui/dom.js';
import { drawFrame, drawGrid } from './ui/preview.js';
import { setTimerMs } from './ui/timer.js';
import { beginEncoding, encodingAt, endEncoding, resetTrim, updateSizeUI } from './ui/timeline-ui.js';
import { FADE_S, elementAudio, fadeIn, fadeOut, fadeReset } from './ui/fade.js';
import { resetMarks } from './ui/marks.js';
import { clipSeek, clipTime, releaseParts } from './ui/clip.js';
import { getBestMime } from './infra/codecs.js';
import { dlBlob, ts } from './infra/download.js';
import { stopRec, startCapture, releaseDisplay } from './recorder.js';
import { pausePlayback, resetPlayback } from './ui/playback.js';
import { clearWaveform } from './ui/waveform.js';
import { cutEndAt, cutsInSeconds, partAt, partStart } from './domain/timeline.js';

export async function doExport(): Promise<void> {
  if (app.phase !== 'review') return;
  pausePlayback();
  setPhase('encoding');
  el.recBtn.disabled   = true;
  el.btnExp.disabled   = true;
  el.btnReset.disabled = true;
  el.playBtn.disabled  = true;
  setStatus('proc', 'Encoding…');
  beginEncoding();
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
  endEncoding();
  pausePlayback();               // refresh the playhead after the export moved rv
}

/* Feed the review clip's audio into the export recorder.
   The export canvas is drawn from the silent <video> element, so without this
   the re-encoded WebM would have a video track only. */
function attachExportAudio(stream: MediaStream): void {
  let tracks: MediaStreamTrack[] = [];
  try {
    // The element's sound is already routed through the fade's gain node (or is
    // put through it here); the recorder listens behind it, so the fades at the
    // joins between takes end up in the file.
    const audio = elementAudio();
    if (audio) {
      if (!app.audioDest) app.audioDest = audio.ctx.createMediaStreamDestination();
      audio.gain.connect(app.audioDest);
      if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
    }
    if (app.audioDest) tracks = app.audioDest.stream.getAudioTracks();
  } catch (err) {
    console.warn('DemoShine: Web Audio passthrough failed —', err);
    app.audioCtx = null; app.audioGain = null; app.audioDest = null; tracks = [];
  }
  // Fallback: pull the audio track straight from the media element.
  if (!tracks.length && typeof el.rv.captureStream === 'function') {
    try { tracks = el.rv.captureStream().getAudioTracks(); } catch { /* element capture unsupported */ }
  }
  tracks.forEach(t => stream.addTrack(t));
}

// An export is driven by the clip playing, not by a clock the page owns, so if
// the clip stops moving — a decode that never starts, a seek that never lands —
// it would sit there for good with the app stuck in 'encoding'. Every step that
// waits has a limit, and gives up loudly rather than quietly.
const STEP_MS = 10000;

function within<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(what)), ms)),
  ]);
}

function exportWebM(): Promise<void> {
  return new Promise((resolve, reject) => {
    let stalled = false;
    const s       = app.trimStart * app.duration;
    // Clamp the end to the clip itself — a measured total, so this is exact.
    const e       = Math.min(app.trimEnd * app.duration, app.duration - 0.05);
    // Cuts (regions trimmed away) are skipped below, so they must not count
    // towards the progress bar or the clip length.
    const cuts    = cutsInSeconds(app.cuts, app.duration);

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
      encodingAt(e, e);                        // the range is written right through
      fadeReset();                             // a fade must never outlive the export
    };

    rec.ondataavailable = ev => { if (ev.data.size > 0) out.push(ev.data); };
    rec.onstop = () => { dlBlob(new Blob(out, { type: 'video/webm' }), 'demoshine-' + ts() + '.webm'); resolve(); };
    rec.onerror = reject;
    rec.start(100);

    // Draw the kept range into the recorder. It may span several recordings, so
    // they are played one after another into the same recorder: the file that
    // comes out is one clip, however many presses of Record it took. A short
    // fade either side of a join softens it — the sound goes down as one take
    // runs out and comes back up as the next begins.
    function drawTo(limit: number, joinAhead: boolean): Promise<void> {
      return new Promise(done => {
        let asked = 0;          // cut end already seeked to, so it is asked for once
        let stuckAt = 0;        // when the playhead last failed to get out of a cut
        let faded = false;      // the fade out before this join has been asked for
        let lastT = -1, movedAt = Date.now();
        (function frame() {
          const t = clipTime();
          if (t !== lastT) { lastT = t; movedAt = Date.now(); }
          else if (Date.now() - movedAt > STEP_MS) { stalled = true; done(); return; }
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
          // Another take follows: bring the sound down over the last FADE_S of
          // this one, so the join does not arrive at full level.
          if (joinAhead && !faded && t >= limit - FADE_S) { faded = true; fadeOut(); }
          ectx?.drawImage(el.rv, 0, 0, ec.width, ec.height);
          try { drawFrame(el.rv); } catch { /* a frame not ready: the next one will do */ }
          encodingAt(t, e);                      // where it has got to, and what is left
          requestAnimationFrame(frame);
        })();
      });
    }

    void (async () => {
      let at = s;
      let first = true;
      while (at < e - 0.01) {
        const index = partAt(app.parts, at);
        const limit = Math.min(partStart(app.parts, index) + app.parts[index].duration, e);
        const joinAhead = limit < e - 0.01;    // this take ends inside the export
        await within(clipSeek(at), STEP_MS, 'the clip would not seek');
        await within(el.rv.play(), STEP_MS, 'the clip would not play');
        // The first take is faithful at its start; past a join the sound comes
        // back up from the fade out, so the join is heard as one clip.
        if (first) first = false; else fadeIn();
        await drawTo(limit, joinAhead);
        if (stalled) throw new Error('the clip stopped playing');
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
