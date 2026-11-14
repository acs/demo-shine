// Ambient globals: gif.js is loaded from a CDN via a plain <script> tag, and
// some browsers still expose the prefixed AudioContext.
declare const GIF: any;

interface Window {
  webkitAudioContext?: typeof AudioContext;
  // Set by the dev server's injected live-reload script.
  __ORBIT_LIVE_RELOAD__?: boolean;
}

// HTMLMediaElement.captureStream() is supported by Chrome and Firefox but is
// missing from some lib.dom revisions.
interface HTMLMediaElement {
  captureStream?(): MediaStream;
}
