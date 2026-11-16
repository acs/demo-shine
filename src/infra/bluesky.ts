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

import { BrowserOAuthClient, buildLoopbackClientId } from '@atproto/oauth-client-browser';
import type { OAuthSession } from '@atproto/oauth-client-browser';
import type { BlueskyService, VideoJob } from '../application/bluesky-service.js';
import type { BlobRef, PostRecord } from '../domain/bluesky/BlueskyPost.js';
import type { PublishableVideo } from '../domain/bluesky/PublishableVideo.js';

const DEPLOYED_HOST = 'acs.github.io';
const CLIENT_METADATA_URL = `https://${DEPLOYED_HOST}/demo-shine/oauth-client-metadata.json`;
const HANDLE_RESOLVER = 'https://bsky.social';
const VIDEO_SERVICE = 'https://video.bsky.app';
const SERVICE_TOKEN_MINUTES = 30;
// The scope the hosted document declares: creating the post, and minting the
// video upload's service token.
const OAUTH_SCOPE = 'atproto transition:generic';

// What atproto's own `isLoopbackHost` accepts as a loopback client's host.
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

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

/**
 * Whether this page is served the one way a sign-in needs no deployed document:
 * over http, on a loopback host. atproto's loopback client is meant for native
 * apps, but it is also how a dev server signs in — the authorization server
 * hard-codes the metadata, so there is no `client_id` URL to host. It is http
 * only: the scheme and host are what the server checks, and the port is ignored.
 */
export function isLoopback(location: { protocol: string; hostname: string }): boolean {
  return location.protocol === 'http:' && LOOPBACK_HOSTS.includes(location.hostname);
}

/**
 * The loopback `client_id` for a location, carrying the scope this app needs —
 * `buildLoopbackClientId` gives `http://localhost?redirect_uri=…`, and without a
 * scope the parsed metadata defaults to `atproto` alone, which cannot write.
 */
export function loopbackClientId(location: { hostname: string; pathname: string; port: string }, scope: string): string {
  return `${buildLoopbackClientId(location)}&scope=${encodeURIComponent(scope)}`;
}

function client(): Promise<BrowserOAuthClient> {
  clientPromise ??= createClient();
  return clientPromise;
}

function createClient(): Promise<BrowserOAuthClient> {
  const here = window.location;
  return isLoopback(here)
    ? BrowserOAuthClient.load({ clientId: loopbackClientId(here, OAUTH_SCOPE), handleResolver: HANDLE_RESOLVER, allowHttp: true })
    : BrowserOAuthClient.load({ clientId: CLIENT_METADATA_URL, handleResolver: HANDLE_RESOLVER });
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
  const here = window.location;
  if (!isLoopback(here) && here.hostname !== DEPLOYED_HOST) {
    throw new Error('Bluesky sign-in works on the deployed app, or on a dev server over http at 127.0.0.1');
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
