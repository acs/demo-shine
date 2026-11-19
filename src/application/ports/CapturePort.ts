// A screen share, named without the browser.
//
// The adapter owns the stream and its tracks; the port says what a use case may
// ask of it. `onEnded` is the person stopping the share from the browser's own UI.

export interface CaptureSession {
  readonly stream: MediaStream;
  readonly hasAudio: boolean;
}

export interface CapturePort {
  /** Ask for a screen share. Rejects when the person cancels. */
  start(): Promise<CaptureSession>;
  /** Release the share and its tracks. */
  stop(): void;
  /** The share held now, or null. */
  current(): CaptureSession | null;
  /** Called when the person stops sharing from the browser's own UI. */
  onEnded(listener: () => void): () => void;
}
