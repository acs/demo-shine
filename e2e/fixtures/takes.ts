// Fixture takes, from the test side.
//
// The encoding happens in page context (encode-take.ts), because WebCodecs and a
// canvas are browser APIs. The blobs stay in the page — a check seeds the clip from
// them there — and the test holds only their metadata.

import type { Page } from '@playwright/test';
import { pageModule } from '../helpers/page-module.js';

export interface FixtureSpec {
  width: number;
  height: number;
  seconds: number;
  fps?: number;
  hasAudio?: boolean;
  pattern?: string;
}

/** A take built in the page: its metadata, and where its blob is kept. */
export interface FixtureTake {
  /** Its position in the page's take store, for `boot.seed`. */
  index: number;
  seconds: number;
  shape: string;
  hasAudio: boolean;
}

interface PageWindow {
  __e2eTakes?: Array<{ blob: Blob; seconds: number; shape: string; hasAudio: boolean }>;
}

/** Build one deterministic take in the page. Resolves in milliseconds. */
export async function makeTake(page: Page, spec: FixtureSpec): Promise<FixtureTake> {
  const [take] = await makeTakes(page, spec);
  return take;
}

/** Build several takes in the page, for a multi-take clip. */
export async function makeTakes(page: Page, ...specs: FixtureSpec[]): Promise<FixtureTake[]> {
  const url = pageModule('e2e/fixtures/encode-take.ts');
  return page.evaluate(async ({ specs, url }) => {
    const mod = await import(/* @vite-ignore */ url);
    const store = ((window as unknown as PageWindow).__e2eTakes ??= []);
    const metas: FixtureTake[] = [];
    for (const spec of specs) {
      const take = await mod.encodeTake(spec);
      const index = store.push(take) - 1;
      metas.push({ index, seconds: take.seconds, shape: take.shape, hasAudio: take.hasAudio });
    }
    return metas;
  }, { specs, url });
}
