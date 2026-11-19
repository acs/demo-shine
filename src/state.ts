// The phase: the one piece of genuinely shared state.
//
// It is the session's state — idle, starting, live, recording, review, encoding —
// and it has one owner and one change event. The views follow it; nothing else is
// shared here. The rest of the app's mutable state lives with the object that owns
// it: the clip on the Session, the streams in the capture adapter, the recorder in
// the take recorder, the crop in the domain, the view state in the view.

export type Phase = 'idle' | 'starting' | 'live' | 'recording' | 'review' | 'encoding';

let phase: Phase = 'idle';

/** The phase the app is in now. */
export function currentPhase(): Phase {
  return phase;
}

export function setPhase(next: Phase): void {
  if (next === phase) return;
  phase = next;
  phaseWatchers.forEach(watcher => watcher(phase));
}

// Views subscribe instead of each holding its own copy of "which buttons are live".
const phaseWatchers: Array<(phase: Phase) => void> = [];

export function onPhaseChange(watcher: (phase: Phase) => void): () => void {
  phaseWatchers.push(watcher);
  return () => {
    const at = phaseWatchers.indexOf(watcher);
    if (at >= 0) phaseWatchers.splice(at, 1);
  };
}
