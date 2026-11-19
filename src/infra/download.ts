// Trigger a browser download for a produced Blob.

import type { DownloadPort } from '../application/ports/DownloadPort.js';

export function dlBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 6000);
}

export function ts(): number {
  return Date.now();
}

export const downloadPort: DownloadPort = {
  save: (blob, filename) => dlBlob(blob, filename),
};
