// The publish flow: putting a clip on Bluesky.
//
// The thinking is in src/application/publish-to-bluesky.ts — the use case, over
// the `BlueskyService` port. This is its browser half: the clip, the MP4 encoder,
// and the OAuth client, which is imported only here so that it stays out of the
// initial bundle and a normal load never carries it.
//
// Nothing here draws. It reports through the handlers it is given, the way the
// export flow reports through the status line.

import { app } from './state.js';
import { el } from './ui/dom.js';
import { exportOffline } from './offline-export.js';
import { publishToBluesky, type PublicationProgress } from './application/publish-to-bluesky.js';
import { AspectRatio } from './domain/bluesky/AspectRatio.js';
import { FADE_S } from './ui/fade.js';
import type { ExportPlan } from './domain/clip/ExportPlan.js';

// The heavy half — the OAuth client — only when a clip is actually published.
const bluesky = () => import('./infra/bluesky.js');

/** A stage of publishing, with a percentage while there is one to give. */
export type PublishProgress = PublicationProgress;

export interface PublishHandlers {
  onProgress?: (progress: PublishProgress) => void;
  onDone: (uri: string) => void;
  onError: (message: string) => void;
}

/** The signed-in account, or null. Loads the client on first ask. */
export async function blueskyAccount(): Promise<string | null> {
  const { initBluesky, blueskyDid } = await bluesky();
  await initBluesky();
  return blueskyDid();
}

/** Send the person to their server to approve. The promise never resolves. */
export async function signInToBluesky(handle: string): Promise<void> {
  await (await bluesky()).signIn(handle.trim());
}

export async function signOutOfBluesky(): Promise<void> {
  await (await bluesky()).signOut();
}

export async function publishClip(text: string, alt: string, handlers: PublishHandlers): Promise<void> {
  try {
    const service = await (await bluesky()).blueskyService();
    const { uri } = await publishToBluesky(app.clip, {
      export: { audio: app.recAudio, fadeSeconds: FADE_S },
      text,
      alt,
      aspectRatio: AspectRatio.of(el.cv.width || 1280, el.cv.height || 720).reduced(),
    }, {
      service,
      // The one thing Bluesky will take: an MP4, encoded over the same plan the
      // download uses, reporting how far through the clip it has got.
      encode: async (plan: ExportPlan) => {
        const { blob } = await exportOffline(plan, {
          target: 'mp4',
          onProgress: source => handlers.onProgress?.({ stage: 'encoding', progress: percent(source, plan.total) }),
        });
        return blob;
      },
      onProgress: handlers.onProgress,
    });
    handlers.onDone(uri);
  } catch (err) {
    handlers.onError((err as Error).message);
  }
}

function percent(source: number, total: number): number {
  return Math.max(0, Math.min(100, Math.round((source / total) * 100)));
}
