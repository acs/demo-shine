// Codec selection — the browser boundary for "which WebM mime can we record?".

const WITH_AUDIO = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
const VIDEO_ONLY = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

export function getBestMime(hasAudio) {
  const list = hasAudio ? WITH_AUDIO : VIDEO_ONLY;
  for (const m of list) if (MediaRecorder.isTypeSupported(m)) return m;
  return null;
}
