// Trigger a browser download for a produced Blob.

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
