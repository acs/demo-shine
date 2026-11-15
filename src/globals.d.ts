// Ambient globals: some browsers still expose the prefixed AudioContext.

// The version from package.json, baked in by vite.config.ts.
declare const __APP_VERSION__: string;

interface Window {
  webkitAudioContext?: typeof AudioContext;
}
