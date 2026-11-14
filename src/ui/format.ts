// Output-format (WebM / GIF) controls and the settings that follow from them.

import { el } from './dom.js';
import { app, type Format } from '../state.js';
import { savePrefs } from '../prefs.js';
import { updateSizeUI, checkGifWarning } from './timeline-ui.js';

export function setFmt(f: Format, silent = false): void {
  app.fmt = f;
  el.fmtWebm.className = f === 'webm' ? 'fmt-btn active' : 'fmt-btn';
  el.fmtGif.className  = f === 'gif'  ? 'fmt-btn active' : 'fmt-btn';
  el.gifOpts.classList.toggle('on', f === 'gif');
  el.audioRow.classList.toggle('on', f === 'webm');
  updateSizeUI();
  checkGifWarning();
  if (!silent) savePrefs();
}

export function onSettingsChange(): void {
  updateSizeUI();
  checkGifWarning();
  savePrefs();
}
