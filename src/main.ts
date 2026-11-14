// Composition root: wires the UI to the use cases and boots the app.

import { el, setStatus, toast } from './ui/dom.js';
import { loadPrefs, savePrefs } from './prefs.js';
import { setFmt, onSettingsChange } from './ui/format.js';
import { applyTheme, toggleTheme } from './ui/theme.js';
import { toggleHelp, helpBdClick } from './ui/help.js';
import { startStarfield } from './ui/starfield.js';
import { drawGrid } from './ui/preview.js';
import { onTrim, updateTrimUI, updateSizeUI } from './ui/timeline-ui.js';
import { toggleRec } from './recorder.js';
import { doExport, resetAll } from './exporter.js';
import { togglePlayback } from './ui/playback.js';

function init(): void {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    el.compatWarn.style.display = '';
    setStatus('', 'Not supported');
  } else {
    setStatus('ready', 'Ready');
  }

  // Apply persisted preferences.
  const prefs = loadPrefs();
  if (prefs.fps)   el.gFps.value   = prefs.fps;
  if (prefs.qual)  el.gQual.value  = prefs.qual;
  if (prefs.audio) el.audioChk.checked = prefs.audio === 'true';
  if (prefs.fmt === 'webm' || prefs.fmt === 'gif') setFmt(prefs.fmt, true);
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

  el.fmtWebm.addEventListener('click', () => setFmt('webm'));
  el.fmtGif.addEventListener('click', () => setFmt('gif'));
  el.gFps.addEventListener('change', onSettingsChange);
  el.gQual.addEventListener('change', savePrefs);
  el.audioChk.addEventListener('change', savePrefs);

  el.recBtn.addEventListener('click', toggleRec);
  el.btnReset.addEventListener('click', resetAll);
  el.btnExp.addEventListener('click', doExport);
  el.playBtn.addEventListener('click', togglePlayback);

  // PWA install prompt
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    toast('Install Orbit Capture — click the ⊕ in your address bar', 5000);
  });

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
