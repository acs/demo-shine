// The composition: the single session object.
//
// The Session itself lives in domain/session/Session.ts and owns the clip. This
// module is the one place that builds it, with the take repository the app uses.

import { Session } from './domain/session/Session.js';
import { Clip } from './domain/clip/Clip.js';
import { InMemoryTakeRepository } from './infra/takes.js';

export const session = new Session(Clip.empty(new InMemoryTakeRepository()));
