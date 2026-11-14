// Trigger a browser download for a produced Blob.

export function dlBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 6000);
}

export function ts() { return Date.now(); }
