// Keeping a clip across a page load, named without IndexedDB.

import type { Clip, ClipSnapshot } from '../../domain/clip/Clip.js';

export interface StoredClip {
  readonly clip: ClipSnapshot;
  readonly audio: boolean;
}

export interface KeptClipPort {
  saveTake(clip: Clip, index: number, audio: boolean): Promise<void>;
  saveMeta(clip: Clip, audio: boolean): Promise<void>;
  saveClip(clip: Clip, audio: boolean): Promise<void>;
  load(): Promise<StoredClip | null>;
  clear(): Promise<void>;
}
