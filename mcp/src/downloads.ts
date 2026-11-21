// Taking the exported file.
//
// The app already ends an export in a download — it hands the finished bytes to the
// browser and the browser writes them — so nothing in the app changes. The server
// takes that download, byte for byte, and saves it where the person can find it. The
// alternative, reading the blob out of the page, would copy a large file through the
// protocol for no reason.
//
// The watcher is installed *before* the export is asked for: a browser download is an
// event, and one that has already fired is not one you can wait for.

import { mkdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Download, Page } from 'playwright';

export interface SavedDownload {
  readonly path: string;
  readonly bytes: number;
}

export interface DownloadWatcher {
  readonly saved: Promise<SavedDownload>;
  /** Nothing is coming: stop waiting. */
  stop(): void;
}

/** Where an exported file goes: the person's Downloads, unless they said otherwise. */
export function downloadsDirectory(): string {
  return process.env.DEMOCLIP_DOWNLOAD_DIR || join(homedir(), 'Downloads');
}

export function watchDownload(page: Page, into: string, timeoutMs = 180_000): DownloadWatcher {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let listener: ((download: Download) => void) | undefined;
  let detach = (): void => {};

  const saved = new Promise<SavedDownload>((resolve, reject) => {
    detach = () => {
      if (timer) clearTimeout(timer);
      if (listener) page.off('download', listener);
    };
    listener = (download: Download) => {
      detach();
      void save(download, into).then(resolve, reject);
    };
    page.on('download', listener);
    timer = setTimeout(() => {
      detach();
      reject(new Error('the export produced no file'));
    }, timeoutMs);
  });

  return { saved, stop: () => detach() };
}

async function save(download: Download, into: string): Promise<SavedDownload> {
  await mkdir(into, { recursive: true });
  const name = download.suggestedFilename() || 'democlip-export';
  const path = join(into, name);
  await download.saveAs(path);
  return { path, bytes: (await stat(path)).size };
}
