export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

// A playback position inside a range, in seconds.
export function clampToClip(time: number, start: number, end: number): number {
  return Math.min(Math.max(time, start), end);
}
