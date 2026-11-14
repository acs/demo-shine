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
├── index.html            # Markup only — links the stylesheet and src/main.js
├── styles.css            # All styling (theme variables, layout, components)
├── src/                  # TypeScript source, compiled to .js by tsc
│   ├── main.ts           # Composition root — wires the UI to the use cases
│   ├── state.ts          # Shared application state (the mutable model)
│   ├── prefs.ts          # User preferences (localStorage)
│   ├── recorder.ts       # Recording use case (getDisplayMedia + MediaRecorder)
│   ├── exporter.ts       # Export + reset use cases (WebM / GIF)
│   ├── globals.d.ts      # Ambient types (gif.js, HTMLMediaElement.captureStream)
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
├── scripts/dev.mjs       # Zero-dependency dev server with live reload
├── tsconfig.json         # TypeScript config (type-check / editor)
├── eslint.config.js      # ESLint (flat config)
├── vitest.config.ts      # Test runner config
├── .husky/pre-commit     # Runs lint-staged on commit
├── manifest.json         # PWA manifest
├── sw.js                 # Service worker — cache-first offline support
└── icon.svg              # App icon
```

The split leans toward a hexagonal shape: `domain/` is pure, `infra/` and `ui/`
are adapters, and `recorder.ts` / `exporter.ts` are the use cases that
`main.ts` composes. It is written in TypeScript and compiled with `tsc` — no bundler.

---

## Development

Requires [Node.js](https://nodejs.org/). Install the dev dependencies once:

```bash
npm install
```

| Command | Does |
|---|---|
| `npm run dev` | Serves the app at http://localhost:5173, compiles TypeScript in watch mode and live-reloads the browser on save |
| `npm run preview` | Builds, then serves the app with the PWA/service worker active (for testing install and offline) |
| `npm run build` | Compiles `src/**/*.ts` to JavaScript next to the sources |
| `npm run build:dist` | Builds a publishable static site into `dist/` |
| `npm run typecheck` | Type-checks without emitting |
| `npm run lint` | ESLint (use `npm run lint:fix` to auto-fix) |
| `npm test` | Runs the Vitest unit tests (`npm run test:watch` to watch) |

The dev server (`npm run dev`) disables the service worker so its cache-first
strategy does not shadow live reload; use `npm run preview` to exercise the real
PWA locally.

Linting runs on every commit through a Husky pre-commit hook, and the CI
workflow runs lint, type-check and tests on every push and pull request.

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

Pushing to `main` runs the **Deploy** workflow, which builds the app
(`npm run build:dist`) and publishes `dist/` to GitHub Pages. Enable it once in
**Settings → Pages → Source → GitHub Actions** (the workflow also attempts to
enable Pages itself). Because the compiled JavaScript is gitignored, the site is
built in CI rather than served from the repo root.

To deploy elsewhere, run `npm run build:dist` and publish the `dist/` folder.

---

## Tech

- [`MediaDevices.getDisplayMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia) — screen capture
- [`MediaRecorder`](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) — WebM encoding
- [`gif.js`](https://github.com/jnordberg/gif.js) — GIF encoding via Web Workers
- [Syne](https://fonts.google.com/specimen/Syne) + [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) — typefaces
- Service Worker + Web App Manifest — PWA support

---

## License

MIT — see [LICENSE.md](LICENSE.md).
