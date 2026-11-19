// The webcam, named without the browser.

export interface WebcamPort {
  start(): Promise<MediaStream>;
  stop(): void;
  current(): MediaStream | null;
}
