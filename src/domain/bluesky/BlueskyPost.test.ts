import { describe, expect, it } from 'vitest';

import { AspectRatio } from './AspectRatio.js';
import { BlueskyPost, type BlobRef, POST_MAX_GRAPHEMES, POST_MAX_LANGS, postUrl } from './BlueskyPost.js';

const at = new Date('2026-01-02T03:04:05.000Z');
const ratio = AspectRatio.of(1280, 720);
const blob: BlobRef = {
  $type: 'blob',
  ref: { $link: 'bafkreiexample' },
  mimeType: 'video/mp4',
  size: 1234,
};

const postOf = (over: Partial<Parameters<typeof BlueskyPost.of>[0]> = {}) =>
  BlueskyPost.of({ text: 'A demo', alt: 'a screen recording', aspectRatio: ratio, createdAt: at, ...over });

describe('BlueskyPost', () => {
  it('writes an app.bsky.feed.post carrying the video as an embed', () => {
    const record = postOf().record(blob);
    expect(record.$type).toBe('app.bsky.feed.post');
    expect(record.text).toBe('A demo');
    expect(record.createdAt).toBe('2026-01-02T03:04:05.000Z');
    expect(record.embed).toEqual({
      $type: 'app.bsky.embed.video',
      video: blob,
      alt: 'a screen recording',
      aspectRatio: { width: 1280, height: 720 },
    });
  });

  it('leaves alt and langs out when there are none', () => {
    const record = postOf({ alt: '', langs: [] }).record(blob);
    expect(record.embed.alt).toBeUndefined();
    expect('alt' in record.embed).toBe(false);
    expect(record.langs).toBeUndefined();
  });

  it('carries up to three languages', () => {
    expect(postOf({ langs: ['en', 'es'] }).record(blob).langs).toEqual(['en', 'es']);
  });

  it('allows an empty text, because the video is the content', () => {
    expect(postOf({ text: '' }).record(blob).text).toBe('');
  });

  it('counts the text in graphemes, not code units', () => {
    // 300 graphemes built from 21 code units each: under the grapheme cap, over
    // the code-unit cap. The code-unit rule is the one that has to refuse it.
    const wide = ('a' + '\u0301'.repeat(20)).repeat(POST_MAX_GRAPHEMES);
    expect(() => postOf({ text: wide })).toThrow(/code units/);
  });

  it('refuses text over 300 graphemes', () => {
    expect(() => postOf({ text: 'a'.repeat(POST_MAX_GRAPHEMES + 1) })).toThrow(/graphemes/);
    expect(() => postOf({ text: 'a'.repeat(POST_MAX_GRAPHEMES) })).not.toThrow();
  });

  it('refuses more than three languages', () => {
    expect(() => postOf({ langs: ['a', 'b', 'c', 'd'] })).toThrow(new RegExp(String(POST_MAX_LANGS)));
  });
});

describe('postUrl', () => {
  const uri = 'at://did:plc:me/app.bsky.feed.post/3kabc';

  it('points at the post in the web client, by handle', () => {
    expect(postUrl(uri, 'alice.bsky.social')).toBe('https://bsky.app/profile/alice.bsky.social/post/3kabc');
  });

  it('falls back to the repo in the uri when the handle is not known', () => {
    expect(postUrl(uri)).toBe('https://bsky.app/profile/did:plc:me/post/3kabc');
    expect(postUrl(uri, '')).toBe('https://bsky.app/profile/did:plc:me/post/3kabc');
  });
});
