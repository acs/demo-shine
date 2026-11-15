// Composition root: wires the UI to the use cases and boots the app.

import { el, setStatus, toast } from './ui/dom.js';
import { loadPrefs } from './prefs.js';
import { applyTheme, toggleTheme } from './ui/theme.js';
import { toggleHelp, helpBdClick } from './ui/help.js';
import { startStarfield } from './ui/starfield.js';
import { drawGrid } from './ui/preview.js';
import { onTrim, updateTrimUI, updateSizeUI } from './ui/timeline-ui.js';
import { toggleRec, startCapture } from './recorder.js';
import { doExport, resetAll } from './exporter.js';
import { togglePlayback } from './ui/playback.js';
import { drawWaveform } from './ui/waveform.js';
import { initRegion } from './ui/region.js';

function init(): void {
  // Screen capture (getDisplayMedia) lives on navigator.mediaDevices, which only
  // exists in a secure context. Over plain HTTP on a non-local host it is
  // undefined — say so plainly instead of claiming the browser is unsupported.
  const hasCapture = typeof navigator.mediaDevices?.getDisplayMedia === 'function';
  if (!hasCapture) {
    // Over plain HTTP on a non-local host, mediaDevices is undefined (insecure
    // context) — say that plainly instead of claiming the browser is unsupported.
    const insecure = !window.isSecureContext;
    el.compatWarn.textContent = insecure ? '⚠ HTTPS required' : '⚠ Browser not supported';
    el.compatWarn.classList.add('on');
    el.idleHint.textContent = insecure
      ? 'Screen capture needs HTTPS — open this page over https://'
      : 'Screen capture is unavailable in this browser';
    el.recBtn.disabled = true;
    setStatus('', insecure ? 'HTTPS required' : 'Not supported');
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

  // PWA install prompt
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    toast('Install DemoShine — click the ⊕ in your address bar', 5000);
  });

  // Keep the audio waveform aligned with the strip on resize.
  window.addEventListener('resize', drawWaveform);

  // Drag on the preview to crop the recording to a region.
  initRegion();

  // Go live as early as the browser allows. getDisplayMedia is gated behind a
  // user gesture + picker, so we (a) try on load, and (b) start on the first
  // interaction anywhere — the capture goes live without the red button.
  const startOnGesture = () => { if (hasCapture) void startCapture(); };
  if (hasCapture) void startCapture();
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
