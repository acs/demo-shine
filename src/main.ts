// Composition root: wires the UI to the use cases and boots the app.

import { el, setStatus, toast } from './ui/dom.js';
import { loadPrefs } from './prefs.js';
import { applyTheme, toggleTheme } from './ui/theme.js';
import { toggleHelp, helpBdClick } from './ui/help.js';
import { startStarfield } from './ui/starfield.js';
import { drawGrid } from './ui/preview.js';
import { onTrim, updateTrimUI, updateSizeUI, initTimelineSeek } from './ui/timeline-ui.js';
import { toggleRec, startCapture } from './recorder.js';
import { doExport, resetAll } from './exporter.js';
import { togglePlayback } from './ui/playback.js';
import { drawWaveform } from './ui/waveform.js';
import { initRegion } from './ui/region.js';
import { initWebcam, toggleWebcam } from './ui/webcam.js';
import { initMic, toggleMic } from './ui/mic.js';

function init(): void {
  const supported = typeof navigator.mediaDevices?.getDisplayMedia === 'function';
  if (!supported) {
    el.compatWarn.style.display = '';
    setStatus('', 'Not supported');
  } else {
    setStatus('ready', 'Ready');
  }

  // Apply persisted preferences.
  const prefs = loadPrefs();
  if (prefs.theme && prefs.theme !== document.documentElement.dataset.theme) applyTheme(prefs.theme);

  drawGrid();
  startStarfield();
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
  el.btnReset.addEventListener('click', resetAll);
  el.btnExp.addEventListener('click', doExport);
  el.playBtn.addEventListener('click', togglePlayback);

  // Click the timeline to play from that point.
  initTimelineSeek();

  // PWA install prompt
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    toast('Install DemoShine — click the ⊕ in your address bar', 5000);
  });

  // Keep the audio waveform aligned with the strip on resize.
  window.addEventListener('resize', drawWaveform);

  // Drag on the preview to crop the recording to a region.
  initRegion();

  // Webcam picture-in-picture toggle (disabled when no camera is present).
  el.webcamBtn.addEventListener('click', toggleWebcam);
  initWebcam();

  // Microphone toggle + level meter (disabled when no mic is present).
  el.micBtn.addEventListener('click', toggleMic);
  initMic();

  // Go live as early as the browser allows. getDisplayMedia is gated behind a
  // user gesture + picker, so we (a) try on load, and (b) start on the first
  // interaction anywhere — the capture goes live without the red button.
  const startOnGesture = () => { if (supported) void startCapture(); };
  if (supported) void startCapture();
  window.addEventListener('pointerdown', startOnGesture, { once: true });
  window.addEventListener('keydown', startOnGesture, { once: true });

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
