// The publish use case: put the clip's export on Bluesky as a video post.
//
// It has the shape of the export — read the clip, decide what to write, hand it
// on — but the "on" is not a download. The kept range is planned as it always is
// (`planExport`), the encoder behind `encode` writes it as MP4, and Bluesky's
// video service is handed the bytes, watched until it has finished, and finally
// asked for a post that carries the finished video.
//
// Bluesky takes `video/mp4` only (see `PublishableVideo`), which is why the
// encode step is a separate concern: DemoShine's download stays WebM, and this
// path writes MP4. None of the browser work — the encoder, the upload, the
// polling — happens here. It is all behind `PublicationDeps`, so the sequencing
// (the order, the progress, giving up) runs in node against a fake.

import type { Clip } from '../domain/clip/Clip.js';
import type { ExportPlan, ExportSettings } from '../domain/clip/ExportPlan.js';
import type { AspectRatio } from '../domain/bluesky/AspectRatio.js';
import { BlueskyPost } from '../domain/bluesky/BlueskyPost.js';
import { PublishableVideo } from '../domain/bluesky/PublishableVideo.js';
import type { BlueskyService, VideoJob } from './bluesky-service.js';
import { planExport } from './export-clip.js';

export type PublicationStage = 'encoding' | 'uploading' | 'processing' | 'posting';

export interface PublicationProgress {
  stage: PublicationStage;
  /** 0..100, the video service's own figure, while it is processing. */
  progress?: number;
}

export interface PublicationSettings {
  /** What of the clip to write — the same settings the export takes. */
  export: ExportSettings;
  /** The post's text. May be empty: the video is the content. */
  text: string;
  /** The video's description, for accessibility. */
  alt?: string;
  /** Up to three language tags. */
  langs?: readonly string[];
  /** The ratio the post shows the video at. */
  aspectRatio: AspectRatio;
}

export interface PublicationDeps {
  service: BlueskyService;
  /** Write the plan as MP4. The browser half; faked in tests. */
  encode: (plan: ExportPlan) => Promise<Blob>;
  now?: () => Date;
  wait?: (ms: number) => Promise<void>;
  onProgress?: (progress: PublicationProgress) => void;
  pollIntervalMs?: number;
  maxPolls?: number;
}

export interface Publication {
  uri: string;
  cid: string;
}

// A minute between polls is too slow to watch and a second is what Bluesky's own
// example uses; two minutes of processing before we stop asking and say so.
const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 120;

export async function publishToBluesky(
  clip: Clip,
  settings: PublicationSettings,
  deps: PublicationDeps,
): Promise<Publication> {
  const plan = planExport(clip, settings.export);
  if (!plan) throw new Error('nothing to publish');

  const now = deps.now ?? (() => new Date());
  const wait = deps.wait ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const createdAt = now();

  deps.onProgress?.({ stage: 'encoding' });
  const video = PublishableVideo.of(
    await deps.encode(plan),
    `demoshine-${createdAt.getTime()}.mp4`,
    settings.aspectRatio,
  );

  deps.onProgress?.({ stage: 'uploading' });
  const uploaded = await deps.service.uploadVideo(video);

  const finished = await waitForVideo(deps, uploaded, wait);
  if (!finished.blob) throw new Error(whyStillNoVideo(finished));

  deps.onProgress?.({ stage: 'posting' });
  const post = BlueskyPost.of({
    text: settings.text,
    alt: settings.alt,
    langs: settings.langs,
    aspectRatio: settings.aspectRatio,
    createdAt,
  });
  const { uri, cid } = await deps.service.createPost(post.record(finished.blob));
  return { uri, cid };
}

/**
 * Poll the video service until it hands back a blob, or fails, or we give up.
 *
 * The blob — not the state — says "done". Bluesky's own warning: a video it has
 * already processed comes back as an *error* that still carries the blob, so a
 * failure with a blob in hand is a success, and the state is only read when there
 * is no blob to use.
 */
async function waitForVideo(
  deps: PublicationDeps,
  first: VideoJob,
  wait: (ms: number) => Promise<void>,
): Promise<VideoJob> {
  const maxPolls = deps.maxPolls ?? MAX_POLLS;
  const interval = deps.pollIntervalMs ?? POLL_INTERVAL_MS;
  let job = first;
  for (let polls = 0; !job.blob && polls <= maxPolls; polls++) {
    if (job.state === 'JOB_STATE_FAILED') return job;
    deps.onProgress?.({ stage: 'processing', progress: job.progress });
    await wait(interval);
    job = await deps.service.videoJob(job.jobId);
  }
  return job;
}

function whyStillNoVideo(job: VideoJob): string {
  if (job.state === 'JOB_STATE_FAILED') {
    return 'Bluesky could not process the video: '
      + (job.message || job.error || job.failureCode || job.state);
  }
  return 'Bluesky is still processing the video';
}
