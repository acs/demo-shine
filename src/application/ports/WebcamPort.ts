// The webcam, named without the browser.

export interface WebcamPort {
  start(deviceId?: string): Promise<MediaStream>;
  stop(): void;
  current(): MediaStream | null;
}
