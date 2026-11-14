// User preferences persisted to localStorage.

import { app } from './state.js';
import { el } from './ui/dom.js';

const KEY = {
  fmt:   'orbit_fmt',
  fps:   'orbit_fps',
  qual:  'orbit_qual',
  audio: 'orbit_audio',
  theme: 'orbit_theme',
};

export function savePrefs() {
  try {
    localStorage.setItem(KEY.fmt,   app.fmt);
    localStorage.setItem(KEY.fps,   el.gFps.value);
    localStorage.setItem(KEY.qual,  el.gQual.value);
    localStorage.setItem(KEY.audio, el.audioChk.checked);
    localStorage.setItem(KEY.theme, document.documentElement.dataset.theme);
  } catch (_) {}
}

// Returns the raw stored values; the composition root decides how to apply them.
export function loadPrefs() {
  try {
    return {
      fmt:   localStorage.getItem(KEY.fmt),
      fps:   localStorage.getItem(KEY.fps),
      qual:  localStorage.getItem(KEY.qual),
      audio: localStorage.getItem(KEY.audio),
      theme: localStorage.getItem(KEY.theme),
    };
  } catch (_) {
    return {};
  }
}
