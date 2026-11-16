// The Bluesky client: OAuth, and the calls the publish use case needs.
//
// The app is a browser with no server, which is what `@atproto/oauth-client-browser`
// is for: it drives a public-client OAuth flow (PKCE, PAR, DPoP) and hands back a
// session whose own `fetchHandler` signs every request to the PDS. That session is
// all `XrpcBlueskyService` needs, so the service is written against a small
// interface and can be tested in node, with no browser and no network.
//
// The video is the one call that does not go to the PDS. It goes to
// `video.bsky.app`, which transcodes it and writes the result to the PDS on the
// user's behalf, using a short-lived service token this asks the PDS for — which
// is why a browser can publish a video at all.
//
// The client metadata lives at `public/oauth-client-metadata.json`, served at the
// URL below. The authorization server fetches that URL and requires it to match
// the `client_id` exactly, so it is a deploy-time fact, not something a dev build
// can fake: signing in only completes on the deployed app.

import { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import type { OAuthSession } from '@atproto/oauth-client-browser';
import type { BlueskyService, VideoJob } from '../application/bluesky-service.js';
import type { BlobRef, PostRecord } from '../domain/bluesky/BlueskyPost.js';
import type { PublishableVideo } from '../domain/bluesky/PublishableVideo.js';

const CLIENT_METADATA_URL = 'https://acs.github.io/demo-shine/oauth-client-metadata.json';
const HANDLE_RESOLVER = 'https://bsky.social';
const VIDEO_SERVICE = 'https://video.bsky.app';
const SERVICE_TOKEN_MINUTES = 30;

// What `XrpcBlueskyService` needs of a session — a slice of `OAuthSession`, so a
// test can stand in for it without the OAuth machinery.
export interface BlueskySession {
  readonly did: string;
  getTokenInfo(): Promise<{ aud: string }>;
  fetchHandler(pathname: string, init?: RequestInit): Promise<Response>;
}

/** One video job, as `app.bsky.video.defs#jobStatus` sends it. */
interface JobStatusBody {
  jobId: string;
  state: string;
  progress?: number;
  blob?: BlobRef;
  error?: string;
  failureCode?: string;
  message?: string;
}

export class XrpcBlueskyService implements BlueskyService {
  constructor(
    private readonly session: BlueskySession,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async uploadVideo(video: PublishableVideo): Promise<VideoJob> {
    const token = await this.serviceToken();
    const url = new URL('/xrpc/app.bsky.video.uploadVideo', VIDEO_SERVICE);
    url.searchParams.set('did', this.session.did);
    url.searchParams.set('name', video.name);
    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': video.blob.type,
        'content-length': String(video.blob.size),
      },
      body: video.blob,
    });
    return this.job(await this.ok(response));
  }

  async videoJob(jobId: string): Promise<VideoJob> {
    const url = new URL('/xrpc/app.bsky.video.getJobStatus', VIDEO_SERVICE);
    url.searchParams.set('jobId', jobId);
    const response = await this.fetchFn(url);
    return this.job(await this.ok(response));
  }

  async createPost(record: PostRecord): Promise<{ uri: string; cid: string }> {
    const response = await this.session.fetchHandler('/xrpc/com.atproto.repo.createRecord', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repo: this.session.did, collection: 'app.bsky.feed.post', record }),
    });
    const body = await this.ok(response) as { uri: string; cid: string };
    return { uri: body.uri, cid: body.cid };
  }

  // A token the video service can use to write the finished video to the PDS. The
  // audience is the PDS as a service DID (`did:web:<host>`), which is how atproto
  // names a server it is not the account of.
  private async serviceToken(): Promise<string> {
    const { aud } = await this.session.getTokenInfo();
    const query = new URLSearchParams({
      aud: `did:web:${new URL(aud).host}`,
      lxm: 'com.atproto.repo.uploadBlob',
      exp: String(Math.floor(Date.now() / 1000) + SERVICE_TOKEN_MINUTES * 60),
    });
    const response = await this.session.fetchHandler(
      `/xrpc/com.atproto.server.getServiceAuth?${query}`,
      { method: 'GET' },
    );
    return (await this.ok(response) as { token: string }).token;
  }

  private async ok(response: Response): Promise<unknown> {
    if (response.ok) return response.json();
    // XRPC says what went wrong in the body; fall back to the status.
    const body = await response.text().catch(() => '');
    let detail = body;
    try { detail = (JSON.parse(body) as { message?: string }).message ?? body; } catch { /* not JSON */ }
    throw new Error(`Bluesky ${response.status}: ${detail || response.statusText}`);
  }

  private job(body: unknown): VideoJob {
    const { jobStatus } = body as { jobStatus: JobStatusBody };
    return {
      jobId: jobStatus.jobId,
      state: jobStatus.state,
      progress: jobStatus.progress,
      blob: jobStatus.blob ?? null,
      error: jobStatus.error,
      failureCode: jobStatus.failureCode,
      message: jobStatus.message,
    };
  }
}

// ── The OAuth client ─────────────────────────────────────────────────────────

let clientPromise: Promise<BrowserOAuthClient> | null = null;
let session: OAuthSession | null = null;

function client(): Promise<BrowserOAuthClient> {
  clientPromise ??= BrowserOAuthClient.load({ clientId: CLIENT_METADATA_URL, handleResolver: HANDLE_RESOLVER });
  return clientPromise;
}

/**
 * Restore the last session, or finish a sign-in the server has just redirected
 * back. Safe to call more than once. Only the callback case runs at startup (see
 * main.ts), so a normal load makes no network call.
 */
export async function initBluesky(): Promise<void> {
  try {
    session = (await (await client()).init(false))?.session ?? session;
  } catch (err) {
    console.warn('Bluesky session could not be restored', err);
  }
}

/** Send the person to their authorization server. The promise never resolves. */
export async function signIn(handle: string): Promise<void> {
  if (window.location.hostname !== 'acs.github.io') {
    throw new Error('Bluesky sign-in only completes on the deployed app (acs.github.io)');
  }
  await (await client()).signIn(handle);
}

export async function signOut(): Promise<void> {
  await session?.signOut();
  session = null;
}

export function blueskyDid(): string | null {
  return session?.did ?? null;
}

/** The service the publish use case wants, once there is a session. */
export async function blueskyService(): Promise<BlueskyService> {
  await initBluesky();
  if (!session) throw new Error('not signed in to Bluesky');
  return new XrpcBlueskyService(session);
}
