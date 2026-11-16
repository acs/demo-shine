import { describe, expect, it } from 'vitest';

import { isLoopback, loopbackClientId, normalizeHandle, XrpcBlueskyService, type BlueskySession } from './bluesky.js';
import { AspectRatio } from '../domain/bluesky/AspectRatio.js';
import type { PostRecord } from '../domain/bluesky/BlueskyPost.js';
import { PublishableVideo } from '../domain/bluesky/PublishableVideo.js';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// A session that answers from a script and remembers what it was asked, so the
// service's request shaping can be read in node with no OAuth and no network.
class FakeSession implements BlueskySession {
  readonly did = 'did:plc:me';
  readonly calls: Array<{ path: string; init?: RequestInit }> = [];

  constructor(private readonly answer: (path: string) => Response = () => json({})) {}

  async getTokenInfo() {
    return { aud: 'https://bsky.social' };
  }
  async fetchHandler(path: string, init?: RequestInit): Promise<Response> {
    this.calls.push({ path, init });
    return this.answer(path);
  }
}

// A stand-in for the fetch to video.bsky.app, which is not the session's server.
class FakeFetch {
  readonly calls: Array<{ url: string; init?: RequestInit }> = [];
  constructor(private readonly answer: () => Response) {}
  readonly fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    this.calls.push({ url: String(input), init });
    return this.answer();
  }) as typeof fetch;
}

const video = PublishableVideo.of(new Blob(['mp4'], { type: 'video/mp4' }), 'demoshine-1.mp4', AspectRatio.of(16, 9));

describe('XrpcBlueskyService', () => {
  it('asks for a service token, then uploads the MP4 to the video service', async () => {
    const session = new FakeSession(path => path.includes('getServiceAuth') ? json({ token: 'svc' }) : json({}));
    const videoFetch = new FakeFetch(() => json({ jobStatus: { jobId: 'j1', did: 'did:plc:me', state: 'JOB_STATE_ENCODED', progress: 20 } }));
    const service = new XrpcBlueskyService(session, videoFetch.fetch);

    const job = await service.uploadVideo(video);

    // The service token is asked of the PDS, for the PDS itself, to upload a blob.
    const auth = session.calls[0];
    expect(auth.path).toContain('/xrpc/com.atproto.server.getServiceAuth?');
    const params = new URLSearchParams(auth.path.split('?')[1]);
    expect(params.get('aud')).toBe('did:web:bsky.social');
    expect(params.get('lxm')).toBe('com.atproto.repo.uploadBlob');
    expect(Number(params.get('exp'))).toBeGreaterThan(Date.now() / 1000);

    // The upload goes to video.bsky.app, with the token, the type and the length.
    const url = new URL(videoFetch.calls[0].url);
    expect(url.origin + url.pathname).toBe('https://video.bsky.app/xrpc/app.bsky.video.uploadVideo');
    expect(url.searchParams.get('did')).toBe('did:plc:me');
    expect(url.searchParams.get('name')).toBe('demoshine-1.mp4');
    const headers = new Headers(videoFetch.calls[0].init?.headers);
    expect(headers.get('authorization')).toBe('Bearer svc');
    expect(headers.get('content-type')).toBe('video/mp4');
    expect(headers.get('content-length')).toBe('3');
    expect(videoFetch.calls[0].init?.body).toBe(video.blob);

    expect(job).toEqual({ jobId: 'j1', state: 'JOB_STATE_ENCODED', progress: 20, blob: null, error: undefined, failureCode: undefined, message: undefined });
  });

  it('asks the video service where a job has got to, and carries the blob back', async () => {
    const blob = { $type: 'blob', ref: { $link: 'bafy' }, mimeType: 'video/mp4', size: 10 } as const;
    const session = new FakeSession();
    const videoFetch = new FakeFetch(() => json({ jobStatus: { jobId: 'j1', did: 'did:plc:me', state: 'JOB_STATE_COMPLETED', blob } }));
    const service = new XrpcBlueskyService(session, videoFetch.fetch);

    const job = await service.videoJob('j1');

    const url = new URL(videoFetch.calls[0].url);
    expect(url.origin + url.pathname).toBe('https://video.bsky.app/xrpc/app.bsky.video.getJobStatus');
    expect(url.searchParams.get('jobId')).toBe('j1');
    expect(job.blob).toEqual(blob);
    expect(job.state).toBe('JOB_STATE_COMPLETED');
  });

  it('writes the post through the session, as the person', async () => {
    const session = new FakeSession(path => path.includes('createRecord') ? json({ uri: 'at://did:plc:me/app.bsky.feed.post/1', cid: 'bafy' }) : json({}));
    const service = new XrpcBlueskyService(session, new FakeFetch(() => json({})).fetch);
    const record = { $type: 'app.bsky.feed.post', text: 'hi', createdAt: '2026-01-01T00:00:00.000Z', embed: { $type: 'app.bsky.embed.video', video: { $type: 'blob', ref: { $link: 'bafy' }, mimeType: 'video/mp4', size: 1 }, aspectRatio: { width: 16, height: 9 } } } satisfies PostRecord;

    const posted = await service.createPost(record);

    const call = session.calls[0];
    expect(call.path).toBe('/xrpc/com.atproto.repo.createRecord');
    expect(call.init?.method).toBe('POST');
    const body = JSON.parse(String(call.init?.body));
    expect(body).toEqual({ repo: 'did:plc:me', collection: 'app.bsky.feed.post', record });
    expect(posted).toEqual({ uri: 'at://did:plc:me/app.bsky.feed.post/1', cid: 'bafy' });
  });

  it('says what the PDS refused when a call fails', async () => {
    const session = new FakeSession(path => path.includes('getServiceAuth') ? json({ message: 'InvalidRequest' }, 400) : json({}));
    const service = new XrpcBlueskyService(session, new FakeFetch(() => json({})).fetch);

    await expect(service.uploadVideo(video)).rejects.toThrow(/Bluesky 400: InvalidRequest/);
  });
});

describe('the loopback client', () => {
  // Signing in from a dev server, without deploying: atproto hard-codes the
  // metadata for the loopback client_id, but only over http on a loopback host.
  it('recognises the one origin that needs no deployed document', () => {
    expect(isLoopback({ protocol: 'http:', hostname: '127.0.0.1' })).toBe(true);
    expect(isLoopback({ protocol: 'http:', hostname: 'localhost' })).toBe(true);
    expect(isLoopback({ protocol: 'http:', hostname: '[::1]' })).toBe(true);
    expect(isLoopback({ protocol: 'https:', hostname: '127.0.0.1' })).toBe(false);   // http only
    expect(isLoopback({ protocol: 'http:', hostname: 'acs.github.io' })).toBe(false);
  });

  it('carries the scope the app needs onto the client id', () => {
    const id = loopbackClientId({ hostname: '127.0.0.1', pathname: '/', port: '5173' }, 'atproto transition:generic');
    expect(id.startsWith('http://localhost?')).toBe(true);
    const params = new URLSearchParams(id.split('?')[1]);
    expect(params.get('redirect_uri')).toBe('http://127.0.0.1:5173/');
    expect(params.get('scope')).toBe('atproto transition:generic');
  });
});

describe('normalizeHandle', () => {
  it('takes a handle the way a person types it', () => {
    expect(normalizeHandle('  @alice.bsky.social ')).toBe('alice.bsky.social');
    expect(normalizeHandle('alice.bsky.social')).toBe('alice.bsky.social');
    expect(normalizeHandle('@alice.com')).toBe('alice.com');   // a custom domain is a handle too
  });
});
