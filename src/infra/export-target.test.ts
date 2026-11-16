import { describe, expect, it } from 'vitest';

import { avcProbes, specFor, videoBitrate } from './export-target.js';

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

  it('gives every codec something to probe, so support is asked, not assumed', () => {
    for (const spec of [specFor('webm'), specFor('mp4')]) {
      for (const choice of spec.video) {
        const probes = choice.probes(1920, 1080);
        expect(probes.length).toBeGreaterThan(0);
        for (const probe of probes) expect(probe).toMatch(/\S/);
      }
    }
  });
});

describe('avcProbes', () => {
  // The level is the last two hex digits of the codec string, e.g. avc1.640028.
  const levelOf = (width: number, height: number): string => avcProbes(width, height)[0].slice(9);

  it('grows the level to fit the picture', () => {
    expect(levelOf(1280, 720)).toBe('1f');     // 3.1 — good to 720p
    expect(levelOf(1920, 1080)).toBe('28');    // 4.0 — 3.1 is refused here
    expect(levelOf(2560, 1440)).toBe('32');    // 5.0
    expect(levelOf(3840, 2160)).toBe('33');    // 5.1
    expect(levelOf(5120, 2880)).toBe('3c');    // 6.0
  });

  it('never offers a level too small for the picture — the 1080p bug', () => {
    // The old probe pinned level 3.1 (avc1.42001f), good only to 1280x720, so any
    // larger capture came back "cannot encode MP4".
    expect(avcProbes(1920, 1080)).not.toContain('avc1.42001f');
    expect(avcProbes(2560, 1440)).not.toContain('avc1.640028');
  });

  it('offers High, Main and Baseline at that level, in that order', () => {
    expect(avcProbes(1920, 1080)).toEqual(['avc1.640028', 'avc1.4d0028', 'avc1.420028']);
  });
});

describe('videoBitrate', () => {
  it('gives a small picture the floor, where 4 Mbps is already clean', () => {
    expect(videoBitrate(1280, 720)).toBe(4_000_000);
    expect(videoBitrate(640, 360)).toBe(4_000_000);
  });

  it('grows with the picture, which is what a screen of small text needs', () => {
    expect(videoBitrate(1920, 1080)).toBe(7_464_960);
    expect(videoBitrate(3440, 1440)).toBe(17_832_960);   // the 1440p screen that blurred
  });

  it('caps, so a long clip stays within the upload limits', () => {
    expect(videoBitrate(3840, 2160)).toBe(24_000_000);
    expect(videoBitrate(7680, 4320)).toBe(24_000_000);
  });
});
