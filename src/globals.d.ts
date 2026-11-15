// Ambient globals: some browsers still expose the prefixed AudioContext.

// The version from package.json, baked in by vite.config.ts.
declare const __APP_VERSION__: string;

interface Window {
  webkitAudioContext?: typeof AudioContext;
}

// HTMLMediaElement.captureStream() is supported by Chrome and Firefox but is
// missing from some lib.dom revisions.
interface HTMLMediaElement {
  captureStream?(): MediaStream;
}
