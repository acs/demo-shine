// A video ready to go to Bluesky: the MP4 bytes, the name it travels under, and
// the ratio the post will show it at.
//
// Bluesky takes `video/mp4` and nothing else — `app.bsky.video.uploadVideo` and
// the `app.bsky.embed.video` blob both declare it — and the embed caps the file
// at 300 MB. DemoShine records WebM, so the export that feeds this has to write
// MP4 (H.264 with AAC); a WebM blob is not constructible here, which is the whole
// point of the type rather than a check every caller has to remember.

import type { AspectRatio } from './AspectRatio.js';

export const VIDEO_MIME = 'video/mp4';
export const VIDEO_MAX_BYTES = 300_000_000;
/** Bluesky's ceiling on length: ten minutes, its own client's `VIDEO_MAX_DURATION_MS`. */
export const VIDEO_MAX_SECONDS = 10 * 60;

export class PublishableVideo {
  private constructor(
    readonly blob: Blob,
    readonly name: string,
    readonly aspectRatio: AspectRatio,
  ) {}

  static of(blob: Blob, name: string, aspectRatio: AspectRatio): PublishableVideo {
    if (blob.type !== VIDEO_MIME) {
      throw new Error(`Bluesky takes ${VIDEO_MIME}, not ${blob.type || 'an unknown type'}`);
    }
    if (blob.size <= 0) throw new Error('a publishable video cannot be empty');
    if (blob.size > VIDEO_MAX_BYTES) {
      throw new Error(`a Bluesky video is at most ${VIDEO_MAX_BYTES} bytes, got ${blob.size}`);
    }
    return new PublishableVideo(blob, name, aspectRatio);
  }
}
