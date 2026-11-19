// Handing a finished file to the person.

export interface DownloadPort {
  save(blob: Blob, filename: string): void;
}
