// The publish dialog: the Bluesky option in the Export menu.
//
// A small modal. Signed out it asks for a handle and sends the person to their
// server; signed in it asks for the post's text and the video's description, then
// hands off to the publish flow (src/publisher.ts) and reports how far it has got.
// It owns the DOM and the fact of being open; it decides nothing about Bluesky.

import { el } from './dom.js';
import {
  blueskyAccount, signInToBluesky, signOutOfBluesky, publishClip, type PublishProgress,
} from '../publisher.js';

const STAGE: Record<PublishProgress['stage'], string> = {
  encoding: 'Encoding the MP4…',
  uploading: 'Uploading to Bluesky…',
  processing: 'Bluesky is processing the video…',
  posting: 'Writing the post…',
};

// A percentage is only worth saying while a stage counts through one.
const counts = (stage: PublishProgress['stage']): boolean => stage === 'encoding' || stage === 'processing';

class PublishDialog {
  private busy = false;

  init(): void {
    el.pubClose.addEventListener('click', () => this.close());
    el.pubBd.addEventListener('click', event => { if (event.target === el.pubBd) this.close(); });
    el.pubSignin.addEventListener('click', () => void this.signIn());
    el.pubHandle.addEventListener('keydown', event => { if (event.key === 'Enter') void this.signIn(); });
    el.pubCancel.addEventListener('click', () => this.close());
    el.pubSignout.addEventListener('click', () => void this.signOut());
    el.pubGo.addEventListener('click', () => void this.publish());
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && this.isOpen) this.close(); });
  }

  get isOpen(): boolean {
    return el.pubBd.classList.contains('on');
  }

  async open(): Promise<void> {
    if (this.busy) return;
    this.status('');
    this.fail('');
    el.pubBd.classList.add('on');
    this.show(await blueskyAccount());
  }

  close(): void {
    if (this.busy) return;    // a publish in flight is not abandoned by a click
    el.pubBd.classList.remove('on');
  }

  private show(account: string | null): void {
    el.pubSigninView.style.display = account ? 'none' : '';
    el.pubComposeView.style.display = account ? '' : 'none';
    if (account) el.pubAs.textContent = 'Signed in as ' + account;
  }

  private async signIn(): Promise<void> {
    // The `@` is how mentions are shown, not part of the handle; the client takes
    // it out too, but the empty check wants the real thing.
    const handle = el.pubHandle.value.trim().replace(/^@/, '');
    if (!handle) { this.fail('Enter your Bluesky handle, like you.bsky.social'); return; }
    this.fail('');
    this.status('Taking you to your server…');
    try {
      await signInToBluesky(handle);   // redirects away; never returns
    } catch (err) {
      this.status('');
      this.fail((err as Error).message);
    }
  }

  private async signOut(): Promise<void> {
    await signOutOfBluesky();
    this.show(null);
  }

  private async publish(): Promise<void> {
    this.busy = true;
    this.fail('');
    el.pubGo.disabled = true;
    el.pubCancel.disabled = true;
    el.pubStatus.textContent = '';
    await publishClip(el.pubText.value, el.pubAlt.value, {
      onProgress: progress => this.status(this.line(progress)),
      onDone: uri => this.status('Published ✓ ' + uri),
      onError: message => { this.status(''); this.fail(message); },
    });
    this.busy = false;
    el.pubGo.disabled = false;
    el.pubCancel.disabled = false;
  }

  private line(progress: PublishProgress): string {
    const base = STAGE[progress.stage] ?? progress.stage;
    return counts(progress.stage) && progress.progress != null ? `${base} ${progress.progress}%` : base;
  }

  private status(text: string): void {
    el.pubStatus.textContent = text;
  }

  private fail(text: string): void {
    el.pubError.textContent = text;
    el.pubError.style.display = text ? '' : 'none';
  }
}

export const publishDialog = new PublishDialog();
