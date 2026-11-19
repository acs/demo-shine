// The resume flow: restore a kept clip at startup and open the review.

import { RestoreClip } from '../../application/restore-clip.js';
import { session } from '../../session.js';
import { keptClip } from '../../infra/clip-store.js';
import { setPhase } from '../../state.js';
import { openReview } from '../clip/review-flow.js';
import { toast } from '../dom.js';

const restore = new RestoreClip({ clip: session.clip, store: keptClip });

export async function resumeClip(): Promise<boolean> {
  const outcome = await restore.run();
  if (outcome.kind !== 'restored') return false;
  session.audio = outcome.audio;
  setPhase('review');
  await openReview(0, 0);
  toast('Your recording was restored');
  return true;
}
