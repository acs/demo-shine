// User preferences persisted to localStorage.

import { app } from './state.js';
import { el } from './ui/dom.js';

const KEY = {
  fmt:   'orbit_fmt',
  fps:   'orbit_fps',
  qual:  'orbit_qual',
  theme: 'orbit_theme',
} as const;

export interface Prefs {
  fmt:   string | null;
  fps:   string | null;
  qual:  string | null;
  theme: string | null;
}

export function savePrefs(): void {
  try {
    localStorage.setItem(KEY.fmt,   app.fmt);
    localStorage.setItem(KEY.fps,   el.gFps.value);
    localStorage.setItem(KEY.qual,  el.gQual.value);
    localStorage.setItem(KEY.theme, document.documentElement.dataset.theme ?? 'dark');
  } catch { /* storage unavailable */ }
}

// Returns the raw stored values; the composition root decides how to apply them.
export function loadPrefs(): Prefs {
  try {
    return {
      fmt:   localStorage.getItem(KEY.fmt),
      fps:   localStorage.getItem(KEY.fps),
      qual:  localStorage.getItem(KEY.qual),
      theme: localStorage.getItem(KEY.theme),
    };
  } catch {
    return { fmt: null, fps: null, qual: null, theme: null };
  }
}
