import { describe, expect, it } from 'vitest';

import { AspectRatio } from './AspectRatio.js';
import { PublishableVideo, VIDEO_MAX_BYTES } from './PublishableVideo.js';

const ratio = AspectRatio.of(16, 9);
const mp4 = (bytes = 1024): Blob => new Blob(['x'.repeat(bytes)], { type: 'video/mp4' });

// Blob.size is a getter, so a file too big to allocate is built by overriding it.
const sized = (size: number, type = 'video/mp4'): Blob =>
  Object.defineProperty(new Blob(['x'], { type }), 'size', { value: size }) as Blob;

describe('PublishableVideo', () => {
  it('is an MP4 with a name and a ratio', () => {
    const blob = mp4();
    const video = PublishableVideo.of(blob, 'demoshine-1.mp4', ratio);
    expect(video.blob).toBe(blob);
    expect(video.name).toBe('demoshine-1.mp4');
    expect(video.aspectRatio).toBe(ratio);
  });

  it('refuses the WebM DemoShine records, which Bluesky will not take', () => {
    expect(() => PublishableVideo.of(new Blob(['x'], { type: 'video/webm' }), 'a.webm', ratio))
      .toThrow(/video\/mp4/);
  });

  it('refuses a type-less blob', () => {
    expect(() => PublishableVideo.of(new Blob(['x']), 'a', ratio)).toThrow(/unknown type/);
  });

  it('refuses an empty file', () => {
    expect(() => PublishableVideo.of(sized(0), 'a.mp4', ratio)).toThrow(/empty/);
  });

  it('takes a file right at the limit and refuses one over it', () => {
    expect(() => PublishableVideo.of(sized(VIDEO_MAX_BYTES), 'a.mp4', ratio)).not.toThrow();
    expect(() => PublishableVideo.of(sized(VIDEO_MAX_BYTES + 1), 'a.mp4', ratio)).toThrow(/at most/);
  });
});
