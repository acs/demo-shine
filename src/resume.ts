// The recording kept across a page load: what a Bluesky sign-in needs, and what a
// reload gets for free.
//
// Signing in to Bluesky leaves the page — the authorization server sends the
// browser away and back — and everything the page held in memory goes with it.
// The takes are the recording itself, the most valuable thing here, so the clip
// is written down as it changes and read back when the app starts: a reload, a
// sign-in, or picking up a new version all come back to the clip. The session is
// over at New, or when the clip is exported — the file written, the post
// published — and the kept copy goes with it.
//
// This is the flow around the store (src/infra/clip-store.ts): when to write,
// when to read, and what the app looks like once it has. The store knows nothing
// about Bluesky, and nothing here knows how a clip is kept.

import { app, setPhase } from './state.js';
import { setStatus, toast } from './ui/dom.js';
import { saveTake, saveMeta, saveClip, loadClip, clearClip } from './infra/clip-store.js';
import { openReviewClip } from './recorder.js';

const SAVE_DELAY_MS = 250;   // a dragged handle fires often; the clip itself is small

let saveTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Keep the clip written down as it changes, and let it go when the session ends.
 * The clip's own events say what happened, so nothing has to call this again.
 */
export function watchClip(): void {
  app.clip.onChange(event => {
    if (event.type === 'cleared') {
      clearTimeout(saveTimer);
      saveTimer = undefined;
      void clearClip();
      return;
    }
    // A take is the recording and never changes, so it is written once, at once.
    // The cuts are a few bytes that move on every trim, so they go on their own
    // and are put off a moment.
    if (event.type === 'take-added') {
      void saveTake(app.clip, event.index, app.recAudio).catch(warn);
      return;
    }
    scheduleSaveMeta();
  });
}

/**
 * Write the clip down and wait for it. The one caller that must not go on without
 * it is a Bluesky sign-in, which is about to leave the page: when the write
 * fails, the caller is told rather than sent away to lose the recording.
 */
export async function persistClip(): Promise<void> {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  if (app.clip.takes.isEmpty()) return;
  try {
    await saveClip(app.clip, app.recAudio);
  } catch (err) {
    // Refusing the sign-in keeps the recording where a person can still export
    // it, which is better than the trip that would take it away.
    throw new Error(
      'Could not keep the recording across the sign-in: ' + why(err)
      + '. Export it to a file first, then try signing in again.',
      { cause: err },
    );
  }
}

function why(err: unknown): string {
  const e = err as { name?: string; message?: string } | null;
  if (e?.name === 'QuotaExceededError') return 'there is no room left in this browser';
  return e?.message || 'the browser refused to write it';
}

/**
 * The clip has gone somewhere — a file written, or a post published. The session
 * is over, so the copy kept for a reload goes with it. The clip itself stays on
 * screen: work on it again and it is kept again.
 */
export function forgetClip(): void {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  void clearClip();
}

/**
 * Put a stored clip back and open the review on it. Nothing happens when there is
 * none, or when the app already holds a clip — a restore is for a page that has
 * just loaded. Returns whether it restored one.
 */
export async function resumeClip(): Promise<boolean> {
  if (!app.clip.takes.isEmpty()) return false;
  const stored = await loadClip();
  if (!stored) return false;
  try {
    app.clip.restore(stored.clip);
  } catch (err) {
    // A clip that cannot be rebuilt is not one to keep re-reading: drop it and
    // start clean rather than fail to start at all.
    console.warn('DemoShine: could not restore the saved clip —', err);
    void clearClip();
    return false;
  }
  app.recAudio = stored.audio;
  setPhase('review');
  setStatus('ready', 'Ready to export');
  toast('Your recording was restored', 4000);
  await openReviewClip(0, 0);
  return true;
}

// A trim fires on every input; the write is put off a moment so a drag is one
// write, not thirty — and what it writes is the few bytes of the cuts, not the
// recording, which is written once when it arrives.
function scheduleSaveMeta(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    void saveMeta(app.clip, app.recAudio).catch(warn);
  }, SAVE_DELAY_MS);
}

function warn(err: unknown): void {
  console.warn('DemoShine: could not keep the clip across a reload —', err);
}
