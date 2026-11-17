// The source buttons' enabled state, in one place.
//
// A button is out when its device is not there, and all three are out while a
// take is being set up or runs — switching a source mid-take would change what
// is being recorded. The device facts arrive from webcam.ts and mic.ts, which
// watch for devices coming and going; the lock comes from the phase. Keeping
// both here is what stops them fighting over the same attribute.

import { app, onPhaseChange, type Phase } from '../state.js';
import { el } from './dom.js';

const present = { camera: false, mic: false };   // whether a device is there at all

// A take in flight owns the sources: it is not to be switched under it.
function locked(phase: Phase): boolean {
  return phase === 'starting' || phase === 'countdown' || phase === 'recording';
}

function refresh(): void {
  const off = locked(app.phase);
  el.screenBtn.disabled = off;
  el.webcamBtn.disabled = off || !present.camera;
  el.micBtn.disabled = off || !present.mic;
}

/** A camera was found (or went away). */
export function setCameraPresent(has: boolean): void {
  present.camera = has;
  refresh();
}

/** A microphone was found (or went away). */
export function setMicPresent(has: boolean): void {
  present.mic = has;
  refresh();
}

export function initSourceButtons(): void {
  onPhaseChange(refresh);
  refresh();
}
