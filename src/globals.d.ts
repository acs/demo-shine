// Ambient globals: gif.js is loaded from a CDN via a plain <script> tag, and
// some browsers still expose the prefixed AudioContext.
declare const GIF: any;

interface Window {
  webkitAudioContext?: typeof AudioContext;
}

// HTMLMediaElement.captureStream() is supported by Chrome and Firefox but is
// missing from some lib.dom revisions.
interface HTMLMediaElement {
  captureStream?(): MediaStream;
}
