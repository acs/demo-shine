# DemoShine

> Pure browser screen recorder. No extensions. No uploads. No server.

WebM screen recording with region crop, a timeline trimmer, playback with sound, automatic tab/system audio, light/dark mode, and PWA install support — written in TypeScript, tested with Vitest and linted with ESLint.

**[→ Launch DemoShine](https://acs.github.io/demo-shine/)**

---

## Features

- **Zero dependencies on your machine** — runs entirely in the browser via `getDisplayMedia`
- **Live preview on start** — the screen capture begins as soon as the app opens (full screen preferred), no need to press record first
- **WebM export** — VP9/VP8 codec with tab/system audio, re-encoded through a canvas stream
- **Region crop** — a red box over the preview always shows what will be recorded: the whole screen by default, drag to record just part of it, click to reset; while recording the box breathes (red ↔ background)
- **Webcam overlay** — a header toggle adds a mirrored webcam bubble in the corner of the recording (disabled when no camera is present)
- **Microphone** — a header toggle (disabled when no mic) with a live level meter; its audio is **mixed with the tab/system audio** in the recording
- **Timeline trimmer** — drag IN/OUT handles, **click the timeline to play from that point**, live size estimate
- **Playback** — play the recorded clip back on the preview with sound, bounded by the IN/OUT handles
- **Audio track** — a waveform of the recording under the thumbnails, shown when the clip has sound
- **3-second countdown** — the live preview stays visible behind it, and pressing record again during it cancels
- **Tab / system audio** — captured automatically whenever the shared tab or window has sound
- **Light / dark mode** — full CSS variable theming, persisted to `localStorage`
- **PWA** — installable as a desktop app, offline-capable for core recording and WebM export
- **No data leaves your browser** — nothing is uploaded or stored remotely

---

## Usage

1. Open [DemoShine](https://acs.github.io/demo-shine/) in Chrome or Edge — the picker opens straight away and the screen goes live in the preview (full screen is preselected; tick **Share tab audio** to capture sound)
2. The red box over the preview shows what will be recorded — the whole screen by default; drag to record only a region, and click to go back to the full screen
3. Press the red button to record — a 3-second countdown runs, and pressing the button again during it cancels; press it again to stop
4. The timeline then appears with a playback control and an audio track
5. Play it back, drag the **blue IN** and **red OUT** handles to trim, or click anywhere on the timeline to start playing from that moment
6. Click **Export ↓** to encode and download

---

## File structure

```
demoshine/
├── index.html            # Entry HTML — links the stylesheet and src/main.ts
├── styles.css            # All styling (theme variables, layout, components)
├── src/                  # TypeScript source
│   ├── main.ts           # Composition root — wires the UI to the use cases
│   ├── state.ts          # Shared application state (the mutable model)
│   ├── prefs.ts          # User preferences (localStorage)
│   ├── recorder.ts       # Recording use case (getDisplayMedia + MediaRecorder)
│   ├── exporter.ts       # Export + reset use cases (WebM)
│   ├── globals.d.ts      # Ambient types (prefixed AudioContext, captureStream)
│   ├── vite-env.d.ts     # Vite client types
│   ├── domain/           # Pure logic — no DOM, no browser APIs
│   │   ├── timeline.ts     # Trim math + file-size estimates
│   │   └── timeline.test.ts
│   ├── infra/            # Browser boundary adapters
│   │   ├── codecs.ts       # WebM mime / codec selection
│   │   └── download.ts     # Blob download trigger
│   └── ui/               # View layer (DOM) — one module per widget
│       ├── dom.ts          # Central element registry + status/toast helpers
│       ├── preview.ts      # Preview canvas, seeking, live mirror
│       ├── region.ts       # Crop-region selection + overlay
│       ├── timeline-ui.ts  # Trim handles, thumbnails, size estimate
│       ├── playback.ts     # Clip playback on the preview
│       ├── waveform.ts     # Audio waveform track
│       ├── theme.ts        # Light / dark theme
│       ├── countdown.ts    # 3-2-1 overlay (cancellable)
│       ├── timer.ts        # Recording clock
│       ├── help.ts         # Instructions modal
│       └── starfield.ts    # Background animation
├── public/               # Copied verbatim into the build
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service worker — cache-first offline support
│   └── icon.svg            # App icon
├── vite.config.ts        # Dev server + build config
├── tsconfig.json         # TypeScript config (type-check / editor)
├── eslint.config.js      # ESLint (flat config)
├── vitest.config.ts      # Test runner config
└── .husky/pre-commit     # Runs lint-staged on commit
```

The split leans toward a hexagonal shape: `domain/` is pure, `infra/` and `ui/`
are adapters, and `recorder.ts` / `exporter.ts` are the use cases that
`main.ts` composes. It is written in TypeScript and served and bundled by
[Vite](https://vite.dev/).

---

## Development

Requires [Node.js](https://nodejs.org/). Install the dev dependencies once:

```bash
npm install
```

| Command | Does |
|---|---|
| `npm run dev` | Starts the Vite dev server at https://localhost:5173 with hot module replacement |
| `npm run build` | Type-checks and builds the production site into `dist/` |
| `npm run preview` | Serves the built site (`dist/`) over HTTPS with the PWA/service worker active |
| `npm run typecheck` | Type-checks without emitting |
| `npm run lint` | ESLint (use `npm run lint:fix` to auto-fix) |
| `npm test` | Runs the Vitest unit tests (`npm run test:watch` to watch) |

The dev server disables the service worker — its cache-first strategy would
shadow HMR — so use `npm run preview` to exercise the real PWA locally.

HTTPS is on by default, using a self-signed certificate from
`@vitejs/plugin-basic-ssl`. Browsers will warn until that certificate is
trusted, and the service worker will not register on an untrusted one — trust
the certificate (add it to your keychain) for install/offline testing.

The app also redirects any `http://` access (localhost included) to `https://`,
because screen capture needs a secure context — so there is no plain-HTTP mode.

Linting runs on every commit through a Husky pre-commit hook, and the CI
workflow runs lint, type-check, tests and the build on every push and pull
request.

---

## Browser support

| Browser | Recording | WebM export | Audio |
|---|---|---|---|
| Chrome 94+ | ✓ | ✓ | ✓ |
| Edge 94+ | ✓ | ✓ | ✓ |
| Firefox 113+ | ✓ | ✓ | Partial |
| Safari | ✗ | — | — |

Safari does not support `getDisplayMedia` for screen capture.

---

## Deploy your own

A PWA has to be served over HTTP(S) from an origin — opening `index.html` from
disk will not register the service worker (it needs a secure context).

Pushing to `main` runs the **Deploy** workflow, which runs `npm run build` and
publishes `dist/` to GitHub Pages. Enable it once in
**Settings → Pages → Source → GitHub Actions** (the workflow also attempts to
enable Pages itself).

To deploy elsewhere, run `npm run build` and publish the `dist/` folder.

---

## Tech

- [Vite](https://vite.dev/) — dev server and build
- [`MediaDevices.getDisplayMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia) — screen capture
- [`MediaRecorder`](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) — WebM encoding
- [Syne](https://fonts.google.com/specimen/Syne) + [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) — typefaces
- Service Worker + Web App Manifest — PWA support

---

## License

MIT — see [LICENSE.md](LICENSE.md).
