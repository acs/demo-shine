// The two containers the export can write, and what each one needs.
//
// The download is WebM; the Bluesky path needs MP4, which is the only thing
// Bluesky's video service takes. Which container to write is an encode-time
// choice, not part of the plan — the plan is the same kept stretches either way —
// so it arrives as a target, and this table turns it into the mime the blob is
// born with and the codecs to probe. The probes are WebCodecs strings, so the
// browser answers whether it can encode them, exactly as the WebM path already
// asks; only the names on the left are Mediabunny's.
//
// Kept apart from src/offline-export.ts and free of any browser, so the table can
// be read and tested in node while the module that encodes cannot.

export type ExportTarget = 'webm' | 'mp4';

/** One video codec Mediabunny knows, and the WebCodecs string that probes it. */
export interface VideoCodecChoice {
  name: 'vp9' | 'vp8' | 'avc';
  probe: string;
}

export interface TargetSpec {
  mime: string;
  video: readonly VideoCodecChoice[];
  audio: 'opus' | 'aac';
}

export function specFor(target: ExportTarget): TargetSpec {
  return target === 'mp4'
    ? { mime: 'video/mp4', video: [{ name: 'avc', probe: 'avc1.42001f' }], audio: 'aac' }
    : {
        mime: 'video/webm',
        video: [
          { name: 'vp9', probe: 'vp09.00.10.08' },
          { name: 'vp8', probe: 'vp8' },
        ],
        audio: 'opus',
      };
}
