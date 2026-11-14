// Central element registry and low-level view helpers.
//
// Every other module reads DOM nodes from here instead of calling
// getElementById itself, so the markup-to-code coupling lives in one place.

export const el = {
  cv:        document.getElementById('preview'),
  sv:        document.getElementById('sv'),
  rv:        document.getElementById('rv'),
  sf:        document.getElementById('sf'),
  idleOv:    document.getElementById('idle-ov'),
  badge:     document.getElementById('rec-badge'),
  timeline:  document.getElementById('timeline'),
  recBtn:    document.getElementById('rec-btn'),
  ctrl:      document.getElementById('ctrl'),
  ring3:     document.getElementById('ring-3'),
  sDot:      document.getElementById('s-dot'),
  sText:     document.getElementById('s-text'),
  tmr:       document.getElementById('tmr'),
  tmrMs:     document.getElementById('tmr-ms'),
  recClock:  document.getElementById('rec-clock'),
  recLbl:    document.getElementById('rec-lbl'),
  btnReset:  document.getElementById('btn-reset'),
  btnExp:    document.getElementById('btn-exp'),
  rStart:    document.getElementById('r-start'),
  rEnd:      document.getElementById('r-end'),
  rFill:     document.getElementById('r-fill'),
  encBar:    document.getElementById('enc-bar'),
  thumbs:    document.getElementById('thumbs'),
  tIn:       document.getElementById('t-in'),
  tOut:      document.getElementById('t-out'),
  tClip:     document.getElementById('t-clip'),
  toastEl:   document.getElementById('toast'),
  resBadge:  document.getElementById('res-badge'),
  cdOv:      document.getElementById('cd-ov'),
  cdNum:     document.getElementById('cd-num'),
  gifWarn:   document.getElementById('gif-warn'),
  tSize:     document.getElementById('t-size'),
  helpBd:    document.getElementById('help-bd'),
  helpBtn:   document.getElementById('help-btn'),
  helpClose: document.getElementById('help-close'),
  audioChk:  document.getElementById('audio-chk'),
  gFps:      document.getElementById('g-fps'),
  gQual:     document.getElementById('g-qual'),
  fmtWebm:   document.getElementById('fmt-webm'),
  fmtGif:    document.getElementById('fmt-gif'),
  gifOpts:   document.getElementById('gif-opts'),
  audioRow:  document.getElementById('audio-row'),
  compatWarn: document.getElementById('compat-warn'),
  metaTheme: document.getElementById('meta-theme'),
  themeIco:  document.getElementById('theme-ico'),
  themeBtn:  document.getElementById('theme-btn'),
};

export const ctx = el.cv.getContext('2d');

export function setStatus(cls, txt) {
  el.sDot.className = 's-dot ' + cls;
  el.sText.textContent = txt;
}

let toastTimer = null;
export function toast(msg, dur = 3000) {
  el.toastEl.textContent = msg;
  el.toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toastEl.classList.remove('show'), dur);
}
