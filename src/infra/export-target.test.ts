import { describe, expect, it } from 'vitest';

import { specFor } from './export-target.js';

describe('specFor', () => {
  it('names WebM with the codecs the download has always used', () => {
    const spec = specFor('webm');
    expect(spec.mime).toBe('video/webm');
    expect(spec.video.map(v => v.name)).toEqual(['vp9', 'vp8']);   // vp9 first, vp8 behind it
    expect(spec.audio).toBe('opus');
  });

  it('names the MP4 Bluesky insists on: H.264 with AAC', () => {
    const spec = specFor('mp4');
    expect(spec.mime).toBe('video/mp4');
    expect(spec.video.map(v => v.name)).toEqual(['avc']);
    expect(spec.audio).toBe('aac');
  });

  it('gives every codec a WebCodecs string to probe, so support is asked, not assumed', () => {
    for (const spec of [specFor('webm'), specFor('mp4')]) {
      expect(spec.video.length).toBeGreaterThan(0);
      for (const codec of spec.video) expect(codec.probe).toMatch(/\S/);
    }
  });
});
