// A playback position inside a range, in seconds.
export function clampToClip(time: number, start: number, end: number): number {
  return Math.min(Math.max(time, start), end);
}

// Is a key press aimed at a field rather than the app? A letter shortcut must not
// take a letter out of an input, and a post being typed must not start playback.
export function typingIn(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  return !!node && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.isContentEditable);
}
