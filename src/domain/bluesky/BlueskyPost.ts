// The post a published clip becomes: an `app.bsky.feed.post` record carrying the
// uploaded video as an `app.bsky.embed.video`.
//
// The rules are the record's own: up to 300 graphemes of text (and 3000 code
// units) — but an empty text is allowed, because the video is the content — up to
// three language tags, and a whole-number aspect ratio of at least one. The video
// is only *referenced*: by the time the post is written the blob is already on the
// PDS, and arrives here as a `blob` ref to be embedded.

import { AspectRatio } from './AspectRatio.js';

export const POST_MAX_GRAPHEMES = 300;
export const POST_MAX_LENGTH = 3000;
export const POST_MAX_LANGS = 3;

/** The blob ref the video service (or `com.atproto.repo.uploadBlob`) hands back. */
export interface BlobRef {
  $type: 'blob';
  ref: { $link: string };
  mimeType: string;
  size: number;
}

/** An `app.bsky.feed.post` record, always carrying the published video. */
export interface PostRecord {
  $type: 'app.bsky.feed.post';
  text: string;
  createdAt: string;
  langs?: string[];
  embed: {
    $type: 'app.bsky.embed.video';
    video: BlobRef;
    alt?: string;
    aspectRatio: { width: number; height: number };
  };
}

export interface PostInput {
  text: string;
  alt?: string;
  langs?: readonly string[];
  aspectRatio: AspectRatio;
  createdAt: Date;
}

export class BlueskyPost {
  private constructor(
    readonly text: string,
    readonly alt: string,
    readonly langs: readonly string[],
    readonly aspectRatio: AspectRatio,
    readonly createdAt: Date,
  ) {}

  static of(input: PostInput): BlueskyPost {
    if (input.text.length > POST_MAX_LENGTH) {
      throw new Error(`a post is at most ${POST_MAX_LENGTH} code units, got ${input.text.length}`);
    }
    const graphemes = countGraphemes(input.text);
    if (graphemes > POST_MAX_GRAPHEMES) {
      throw new Error(`a post is at most ${POST_MAX_GRAPHEMES} graphemes, got ${graphemes}`);
    }
    const langs = input.langs ?? [];
    if (langs.length > POST_MAX_LANGS) {
      throw new Error(`a post lists at most ${POST_MAX_LANGS} languages, got ${langs.length}`);
    }
    return new BlueskyPost(input.text, input.alt ?? '', langs, input.aspectRatio, input.createdAt);
  }

  /** The record to write, with the finished video's blob in it. */
  record(video: BlobRef): PostRecord {
    return {
      $type: 'app.bsky.feed.post',
      text: this.text,
      createdAt: this.createdAt.toISOString(),
      ...(this.langs.length ? { langs: [...this.langs] } : {}),
      embed: {
        $type: 'app.bsky.embed.video',
        video,
        ...(this.alt ? { alt: this.alt } : {}),
        aspectRatio: { width: this.aspectRatio.width, height: this.aspectRatio.height },
      },
    };
  }
}

// Bluesky counts a post in graphemes, which is what a person sees: an emoji with
// its modifiers, an accented letter built from two code points. `Intl.Segmenter`
// knows the boundaries; a code point count is the honest fallback where it is not
// there, and errs towards refusing a post rather than sending a long one.
function countGraphemes(text: string): number {
  if (typeof Intl.Segmenter === 'function') {
    return [...new Intl.Segmenter().segment(text)].length;
  }
  return [...text].length;
}
