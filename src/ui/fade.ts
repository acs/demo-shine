// The joins between recordings, softened.
//
// Takes are played one after another in the same video, so the moment one ends
// and the next is loaded is abrupt: the sound stops mid-phrase and the next
// starts at full level. A fade out just before the join and a fade in just after
// it takes the edge off — short enough not to be heard as a fade at all.
//
// The element's sound is routed through one gain node, and everything that
// listens sits behind it: the preview hears it, and during an export so does the
// recorder, so what is heard and what is written carry the same fades.

import { app } from '../state.js';
import { el } from './dom.js';

export const FADE_S = 0.08;   // how long either side of a join, in seconds
const FULL   = 1;       // the level the sound sits at

// The element's sound through the gain node, made once. Null if the browser will
// not give us an audio context.
export function elementAudio(): { ctx: AudioContext; gain: GainNode } | null {
  if (app.audioCtx && app.audioGain) return { ctx: app.audioCtx, gain: app.audioGain };
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try {
    const ctx = app.audioCtx ?? new Ctx();
    const gain = ctx.createGain();
    gain.gain.value = FULL;
    ctx.createMediaElementSource(el.rv).connect(gain);
    gain.connect(ctx.destination);          // the preview goes on being audible
    app.audioCtx = ctx;
    app.audioGain = gain;
    // Autoplay policy can leave the context suspended; resume it on play.
    el.rv.addEventListener('play', () => {
      if (app.audioCtx && app.audioCtx.state === 'suspended') app.audioCtx.resume().catch(() => {});
    });
    void ctx.resume().catch(() => {});
    return { ctx, gain };
  } catch {
    return null;
  }
}

// Off before a join...
export function fadeOut(): void {
  ramp(0);
}

// ...and back on just after it.
export function fadeIn(): void {
  ramp(FULL);
}

// Whatever the sound is doing, put it back to full: a fade must never be left
// half-applied, or the rest of the clip would be silent. Nothing to do when the
// element's sound was never routed through the gain node.
export function fadeReset(): void {
  const ctx = app.audioCtx, gain = app.audioGain;
  if (!ctx || !gain) return;
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(FULL, now);
}

function ramp(to: number): void {
  const a = elementAudio();
  if (!a) return;
  const g = a.gain.gain;
  const now = a.ctx.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(to, now + FADE_S);
}
