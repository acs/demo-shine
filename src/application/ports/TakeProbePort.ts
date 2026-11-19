// How long a recorded blob really is.

export interface TakeProbePort {
  /** A blob's duration in seconds. Rejects when the blob cannot be read. */
  measure(blob: Blob): Promise<number>;
}
