// The take probe: how long a recorded blob really is.
//
// A MediaRecorder WebM often reports `Infinity` until it is seeked past its end.
// The probe hides that in the browser boundary and answers with a number.

import type { TakeProbePort } from '../application/ports/TakeProbePort.js';

export class TakeProbeAdapter implements TakeProbePort {
  async measure(blob: Blob): Promise<number> {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(blob);
    video.src = url;
    try {
      await new Promise<void>((resolve, reject) => {
        video.addEventListener('loadedmetadata', () => resolve(), { once: true });
        video.addEventListener('error', () => reject(new Error('cannot read the take')), { once: true });
      });
      if (Number.isFinite(video.duration) && video.duration > 0.1) return video.duration;
      // Seek past the end to force the browser to read the real duration.
      await new Promise<void>(resolve => {
        video.addEventListener('durationchange', () => resolve(), { once: true });
        video.currentTime = 1e101;
        setTimeout(resolve, 1500);
      });
      return Number.isFinite(video.duration) && video.duration > 0.1 ? video.duration : 0;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export const takeProbe = new TakeProbeAdapter();
