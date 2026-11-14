# Orbit Capture

> Pure browser screen recorder. No extensions. No uploads. No server.

WebM and GIF export with a timeline trimmer, 3-second countdown, system audio capture, light/dark mode, and PWA install support — written in TypeScript, tested with Vitest and linted with ESLint.

**[→ Launch Orbit Capture](https://afonsobranco.github.io/orbit-capture/)**

---

## Features

- **Zero dependencies on your machine** — runs entirely in the browser via `getDisplayMedia`
- **WebM export** — VP9/VP8 codec, optional tab/system audio, re-encoded through a canvas stream
- **GIF export** — frame-sampled via `gif.js`, capped at 960 px wide, configurable FPS and quality
- **Timeline trimmer** — drag IN/OUT handles, click thumbnail frames to scrub, live size estimate
- **Playback** — play the recorded clip back on the preview with sound, bounded by the IN/OUT handles
- **3-second countdown** — live screen preview shown behind the countdown so you can frame your shot
- **System audio toggle** — opt-in tab audio capture (WebM only, Chrome/Edge)
- **GIF duration warning** — export button turns amber and a warning badge appears when the clip exceeds 30 s
- **Light / dark mode** — full CSS variable theming, persisted to `localStorage`
- **PWA** — installable as a desktop app, offline-capable for core recording and WebM export
- **No data leaves your browser** — nothing is uploaded or stored remotely

---

## Usage

1. Open [orbit-capture](https://afonsobranco.github.io/orbit-capture/) in Chrome or Edge
2. Choose **WebM** or **GIF** and configure FPS / quality if needed
3. Toggle **System Audio** on if you want tab audio (WebM only)
4. Click the red button — pick your screen, window, or tab when prompted
5. Wait out the 3-second countdown, then record
6. Click again to stop — the timeline appears
7. Drag the **blue IN** and **red OUT** handles to trim your clip
8. Click **Export ↓** to encode and download

---

## Format guide

| | WebM | GIF |
|---|---|---|
| **Best for** | GitHub PRs, Notion, Slack | Anywhere that won't embed video |
| **Quality** | High — near-lossless at low file size | Lossy — 256-colour palette |
| **Audio** | ✓ (tab/system) | ✗ |
| **30 s clip** | ~3–16 MB | ~8–30 MB |
| **Compatibility** | Chrome, Firefox, Edge | Universal |

---

## File structure

```
orbit-capture/
├── index.html            # Entry HTML — links the stylesheet and src/main.ts
├── styles.css            # All styling (theme variables, layout, components)
├── src/                  # TypeScript source
│   ├── main.ts           # Composition root — wires the UI to the use cases
│   ├── state.ts          # Shared application state (the mutable model)
│   ├── prefs.ts          # User preferences (localStorage)
│   ├── recorder.ts       # Recording use case (getDisplayMedia + MediaRecorder)
│   ├── exporter.ts       # Export + reset use cases (WebM / GIF)
│   ├── globals.d.ts      # Ambient types (gif.js, HTMLMediaElement.captureStream)
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
│       ├── timeline-ui.ts  # Trim handles, thumbnails, size + GIF warning
│       ├── format.ts       # WebM / GIF toggle + settings
│       ├── theme.ts        # Light / dark theme
│       ├── countdown.ts    # 3-2-1 overlay
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
| `npm run dev` | Starts the Vite dev server at https://localhost:5173 with hot module replacement (HTTPS by default) |
| `npm run build` | Type-checks and builds the production site into `dist/` |
| `npm run preview` | Serves the built site (`dist/`) over HTTPS with the PWA/service worker active |
| `npm run dev:http` / `preview:http` | Same, but over plain HTTP |
| `npm run typecheck` | Type-checks without emitting |
| `npm run lint` | ESLint (use `npm run lint:fix` to auto-fix) |
| `npm test` | Runs the Vitest unit tests (`npm run test:watch` to watch) |

The dev server disables the service worker — its cache-first strategy would
shadow HMR — so use `npm run preview` to exercise the real PWA locally.

HTTPS is on by default, using a self-signed certificate from
`@vitejs/plugin-basic-ssl`. Browsers will warn until that certificate is
trusted, and the service worker will not register on an untrusted one — trust
the certificate (add it to your keychain) for install/offline testing. Use
`npm run dev:http` / `preview:http` for plain HTTP.

Linting runs on every commit through a Husky pre-commit hook, and the CI
workflow runs lint, type-check, tests and the build on every push and pull
request.

---

## Browser support

| Browser | Recording | WebM export | GIF export | Audio |
|---|---|---|---|---|
| Chrome 94+ | ✓ | ✓ | ✓ | ✓ |
| Edge 94+ | ✓ | ✓ | ✓ | ✓ |
| Firefox 113+ | ✓ | ✓ | ✓ | Partial |
| Safari | ✗ | — | — | — |

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
- [`gif.js`](https://github.com/jnordberg/gif.js) — GIF encoding via Web Workers
- [Syne](https://fonts.google.com/specimen/Syne) + [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) — typefaces
- Service Worker + Web App Manifest — PWA support

---

## License

MIT — see [LICENSE.md](LICENSE.md).
