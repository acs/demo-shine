// Composition root: wires the UI to the use cases and boots the app.

import { el, setStatus, toast } from './ui/dom.js';
import { initVersion } from './ui/version.js';
import { onPhaseChange, app, type Phase } from './state.js';
import { loadPrefs } from './prefs.js';
import { applyTheme, toggleTheme } from './ui/theme.js';
import { toggleHelp, helpBdClick } from './ui/help.js';
import { drawGrid } from './ui/preview.js';
import { initTimeline, onTrim, updateTrimUI, updateSizeUI } from './ui/timeline-ui.js';
import { initTimelineMarks } from './ui/marks.js';
import { toggleRec, toggleScreen, syncSources } from './recorder.js';
import { doExport, startNewSession } from './exporter.js';
import { playback } from './ui/playback.js';
import { waveform } from './ui/waveform.js';
import { initRegion } from './ui/region.js';
import { initWebcam, toggleWebcam } from './ui/webcam.js';
import { initMic, toggleMic } from './ui/mic.js';
import { initSourceButtons, setScreenAvailable } from './ui/source-buttons.js';
import { exportMenu } from './ui/export-menu.js';
import { publishDialog } from './ui/publish-dialog.js';
import { watchClip, resumeClip } from './resume.js';

function init(): void {
  // Not every browser can share a screen: no mobile browser implements
  // getDisplayMedia, and neither does Safari on macOS. That is not "not
  // supported" — the webcam and the mic still work — so the header says what is
  // missing and the Screen button is out (source-buttons.ts). A browser with no
  // mediaDevices at all is a different thing, and is said plainly.
  const hasMedia = !!navigator.mediaDevices;
  const canShare = typeof navigator.mediaDevices?.getDisplayMedia === 'function';
  if (hasMedia && !canShare) el.compatWarn.classList.add('on');
  setStatus(hasMedia ? 'ready' : '', hasMedia ? 'Ready' : 'Not supported');

  // Apply persisted preferences.
  const prefs = loadPrefs();
  if (prefs.theme && prefs.theme !== document.documentElement.dataset.theme) applyTheme(prefs.theme);

  drawGrid();
  initVersion();
  updateTrimUI();
  updateSizeUI();

  // Controls — these used to be inline onclick/onchange handlers in the markup.
  el.rStart.addEventListener('input', onTrim);
  el.rEnd.addEventListener('input', onTrim);

  el.themeBtn.addEventListener('click', toggleTheme);
  el.helpBtn.addEventListener('click', toggleHelp);
  el.helpClose.addEventListener('click', toggleHelp);
  el.helpBd.addEventListener('click', helpBdClick);

  el.recBtn.addEventListener('click', toggleRec);
  el.btnNew.addEventListener('click', startNewSession);
  el.btnExp.addEventListener('click', () => exportMenu.toggle());
  exportMenu.init(choice => {
    if (choice === 'bluesky') void publishDialog.open();
    else void doExport(choice);
  });
  publishDialog.init();
  el.playBtn.addEventListener('click', () => playback.toggle());

  // New is the way back to the share picker — it is how you re-share after
  // forgetting to tick "share audio" — so it is offered while a capture is live
  // ("waiting to record") as well as while a clip is being reviewed. It stays
  // hidden while the recording runs, where a press would be read as "stop"
  // instead.
  const showNew = (phase: Phase) => { el.btnNew.style.display = phase === 'live' || phase === 'review' ? '' : 'none'; };
  onPhaseChange(showNew);
  showNew(app.phase);

  // Click the timeline to play from that point, mark a section and trim it.
  initTimelineMarks();
  initTimeline();   // the timeline listens to the clip

  // The clip outlives the page. It is kept written down as it changes — a reload
  // or a new version comes back to it, and the trip a Bluesky sign-in takes is
  // only the one that forced it — and a stored clip is opened back into the
  // review on the way in. The session is over at New, or when the clip is
  // exported, and the kept copy goes with it.
  watchClip();
  void resumeClip();

  // PWA install prompt
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    toast('Install DemoShine — click the ⊕ in your address bar', 5000);
  });

  // Keep the audio waveform aligned with the strip on resize.
  window.addEventListener('resize', () => waveform.draw());

  // Drag on the preview to crop the recording to a region.
  initRegion();

  // The record sources, independent of one another. Turning the screen off lets
  // the share go; the webcam is the whole picture while the screen is off, so
  // the preview is synced once it has really started or stopped. All three are
  // out when their device is missing and while a take is being set up or runs
  // (source-buttons.ts).
  setScreenAvailable(canShare);
  initSourceButtons();
  el.screenBtn.addEventListener('click', toggleScreen);
  el.webcamBtn.addEventListener('click', async () => { await toggleWebcam(); syncSources(); });
  initWebcam();

  // Microphone toggle + level meter.
  el.micBtn.addEventListener('click', toggleMic);
  initMic();

  // A Bluesky sign-in only finishes when the authorization server sends us back.
  // The OAuth client is heavy and only needed then, so it loads on demand: a
  // normal load reaches for no network and does not carry it in the bundle.
  const url = new URL(window.location.href);
  const returning = [url.search, url.hash].some(part => part.includes('code=') || part.includes('error='));
  if (returning) void import('./infra/bluesky.js').then(({ initBluesky }) => initBluesky());

  // Nothing is captured on load: every source starts off, and the Screen and
  // Webcam buttons are what start one. A take needs a picture, so Record with
  // nothing on says so rather than reaching for the screen.

  // Service worker: off under Vite's dev server, whose cache-first strategy
  // would shadow HMR; on for builds and `vite preview` (a real, installable,
  // offline-capable PWA). Any leftover worker is removed in dev.
  if ('serviceWorker' in navigator) {
    if (import.meta.env.DEV) {
      navigator.serviceWorker.getRegistrations()
        .then(rs => rs.forEach(r => r.unregister()))
        .catch(() => {});
    } else {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }
}

init();
