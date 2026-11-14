// Central element registry and low-level view helpers.
//
// Every other module reads DOM nodes from here instead of calling
// getElementById itself, so the markup-to-code coupling lives in one place.

export function byId<T extends Element>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Orbit: missing #${id}`);
  return node as unknown as T;
}

export const el = {
  cv:        byId<HTMLCanvasElement>('preview'),
  sv:        byId<HTMLVideoElement>('sv'),
  rv:        byId<HTMLVideoElement>('rv'),
  sf:        byId<HTMLCanvasElement>('sf'),
  idleOv:    byId<HTMLElement>('idle-ov'),
  badge:     byId<HTMLElement>('rec-badge'),
  timeline:  byId<HTMLElement>('timeline'),
  recBtn:    byId<HTMLButtonElement>('rec-btn'),
  ctrl:      byId<HTMLElement>('ctrl'),
  ring3:     byId<HTMLElement>('ring-3'),
  sDot:      byId<HTMLElement>('s-dot'),
  sText:     byId<HTMLElement>('s-text'),
  tmr:       byId<HTMLElement>('tmr'),
  tmrMs:     byId<HTMLElement>('tmr-ms'),
  recClock:  byId<HTMLElement>('rec-clock'),
  recLbl:    byId<HTMLElement>('rec-lbl'),
  btnReset:  byId<HTMLButtonElement>('btn-reset'),
  btnExp:    byId<HTMLButtonElement>('btn-exp'),
  rStart:    byId<HTMLInputElement>('r-start'),
  rEnd:      byId<HTMLInputElement>('r-end'),
  rFill:     byId<HTMLElement>('r-fill'),
  playhead:  byId<HTMLElement>('playhead'),
  playBtn:   byId<HTMLButtonElement>('play-btn'),
  tNow:      byId<HTMLElement>('t-now'),
  encBar:    byId<HTMLElement>('enc-bar'),
  thumbs:    byId<HTMLElement>('thumbs'),
  tIn:       byId<HTMLElement>('t-in'),
  tOut:      byId<HTMLElement>('t-out'),
  tClip:     byId<HTMLElement>('t-clip'),
  toastEl:   byId<HTMLElement>('toast'),
  resBadge:  byId<HTMLElement>('res-badge'),
  cdOv:      byId<HTMLElement>('cd-ov'),
  cdNum:     byId<HTMLElement>('cd-num'),
  gifWarn:   byId<HTMLElement>('gif-warn'),
  tSize:     byId<HTMLElement>('t-size'),
  helpBd:    byId<HTMLElement>('help-bd'),
  helpBtn:   byId<HTMLButtonElement>('help-btn'),
  helpClose: byId<HTMLButtonElement>('help-close'),
  audioChk:  byId<HTMLInputElement>('audio-chk'),
  gFps:      byId<HTMLSelectElement>('g-fps'),
  gQual:     byId<HTMLSelectElement>('g-qual'),
  fmtWebm:   byId<HTMLButtonElement>('fmt-webm'),
  fmtGif:    byId<HTMLButtonElement>('fmt-gif'),
  gifOpts:   byId<HTMLElement>('gif-opts'),
  audioRow:  byId<HTMLElement>('audio-row'),
  compatWarn: byId<HTMLElement>('compat-warn'),
  metaTheme: byId<HTMLMetaElement>('meta-theme'),
  themeIco:  byId<SVGElement>('theme-ico'),
  themeBtn:  byId<HTMLButtonElement>('theme-btn'),
};

export const ctx: CanvasRenderingContext2D = (() => {
  const c = el.cv.getContext('2d');
  if (!c) throw new Error('Orbit: 2D canvas context unavailable');
  return c;
})();

export function setStatus(cls: string, txt: string): void {
  el.sDot.className = 's-dot ' + cls;
  el.sText.textContent = txt;
}

let toastTimer: number | undefined;
export function toast(msg: string, dur = 3000): void {
  el.toastEl.textContent = msg;
  el.toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toastEl.classList.remove('show'), dur);
}
