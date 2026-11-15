// The export's size, as the timeline shows it.
//
// Drafting advice rather than a rule, which is why it moved out of the domain when
// the domain got a shape: nothing here decides anything, it only puts a number
// where a person can see it.

export function estimateWebmText(clipSeconds: number): string {
  const lo = clipSeconds * 0.1;    // ~800 Kbps low motion
  const hi = clipSeconds * 0.55;   // ~4.4 Mbps high motion
  return `~${lo.toFixed(1)}–${hi.toFixed(1)} MB (WebM)`;
}
