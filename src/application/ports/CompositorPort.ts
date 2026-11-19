// The compositor: what a take actually records.
//
// It draws the crop of the screen and the webcam bubble, and mixes the audio. The
// bubble's drawing is injected by the composition root; the compositor imports no
// view module.

import type { CropRegion } from '../../domain/capture/CropRegion.js';

export interface CompositorInput {
  readonly screen: MediaStream | null;
  readonly webcam: MediaStream | null;
  readonly mic: MediaStream | null;
  readonly region: CropRegion;
  readonly audio: boolean;
  /** Draw the webcam bubble, if the view has one. */
  readonly drawBubble?: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
}

export interface CompositorSession {
  readonly stream: MediaStream;
  readonly hasAudio: boolean;
}

export interface CompositorPort {
  /** Draw the crop and the bubble, mix the audio, and return the stream to record. */
  open(input: CompositorInput): CompositorSession;
  close(): void;
}
