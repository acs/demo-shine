// Stand-ins for what a machine cannot drive: the share picker and the devices.
//
// `getDisplayMedia` needs a user gesture and a browser pane, so a check never opens
// the picker. It stands in for what comes *back* from one — a canvas stream — which
// is where the app's handling lives, and where the recent regressions were.

import type { Page } from '@playwright/test';

export interface StandInShareOptions {
  /** Resolve a stream with no audio track, so the app reports a silent share. */
  silent?: boolean;
  width?: number;
  height?: number;
  /**
   * Report a different size from the track's settings than the picture really is,
   * as a display track does until a tab's first frame lands — so a check can prove
   * the app sizes the capture from the picture, not from the settings.
   */
  settingsSize?: { width: number; height: number };
}

interface AskedWindow {
  __e2eAskedFor?: DisplayMediaStreamOptions | null;
}

/** Install before `boot.goto()`, so the stand-in is in place before the app loads. */
export async function installStandInShare(page: Page, options: StandInShareOptions = {}): Promise<void> {
  await page.addInitScript((opts: StandInShareOptions) => {
    const media = navigator.mediaDevices;
    if (!media) return;

    media.getDisplayMedia = async (constraints?: DisplayMediaStreamOptions) => {
      (window as unknown as AskedWindow).__e2eAskedFor = constraints ?? null;

      const canvas = document.createElement('canvas');
      canvas.width = opts.width ?? 1280;
      canvas.height = opts.height ?? 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#3366ff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(canvas.width * 0.3, canvas.height * 0.3, canvas.width * 0.4, canvas.height * 0.4);
      }

      const stream = canvas.captureStream(30);

      if (opts.settingsSize) {
        const track = stream.getVideoTracks()[0];
        if (track) {
          const real = track.getSettings.bind(track);
          track.getSettings = () => ({ ...real(), width: opts.settingsSize!.width, height: opts.settingsSize!.height });
        }
      }

      if (!opts.silent) {
        try {
          const audio = new AudioContext();
          const destination = audio.createMediaStreamDestination();
          const oscillator = audio.createOscillator();
          oscillator.connect(destination);
          oscillator.start();
          for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);
        } catch {
          // No audio available; the share is silent, which is itself worth covering.
        }
      }

      return stream;
    };
  }, options);
}

/** The constraints the app passed to `getDisplayMedia`, or null if it was not asked. */
export async function askedFor(page: Page): Promise<DisplayMediaStreamOptions | null> {
  return page.evaluate(() => (window as unknown as AskedWindow).__e2eAskedFor ?? null);
}
