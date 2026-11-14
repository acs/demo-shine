// Ambient globals: some browsers still expose the prefixed AudioContext.

interface Window {
  webkitAudioContext?: typeof AudioContext;
}

// HTMLMediaElement.captureStream() is supported by Chrome and Firefox but is
// missing from some lib.dom revisions.
interface HTMLMediaElement {
  captureStream?(): MediaStream;
}
