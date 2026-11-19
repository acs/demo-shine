// The microphone, named without the browser.

export interface MicrophonePort {
  start(): Promise<MediaStream>;
  stop(): void;
  current(): MediaStream | null;
}
