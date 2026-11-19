// A recorder: start on a stream, stop with the bytes.

export interface TakeRecorderPort {
  start(stream: MediaStream): void;
  /** Stop and resolve with the recorded bytes. */
  stop(): Promise<Blob>;
  isRecording(): boolean;
}
