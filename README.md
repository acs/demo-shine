# Orbit Capture

> Pure browser screen recorder. No extensions. No uploads. No server.

WebM and GIF export with a timeline trimmer, 3-second countdown, system audio capture, light/dark mode, and PWA install support — split into native ES modules, with no build step.

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
├── index.html          # Markup only — links the stylesheet and src/main.js
├── styles.css          # All styling (theme variables, layout, components)
├── src/
│   ├── main.js         # Composition root — wires the UI to the use cases, boots the app
│   ├── state.js        # Shared application state (the mutable model)
│   ├── prefs.js        # User preferences (localStorage)
│   ├── recorder.js     # Recording use case (getDisplayMedia + MediaRecorder)
│   ├── exporter.js     # Export + reset use cases (WebM / GIF)
│   ├── domain/         # Pure logic — no DOM, no browser APIs
│   │   └── timeline.js   # Trim math + file-size estimates
│   ├── infra/          # Browser boundary adapters
│   │   ├── codecs.js     # WebM mime / codec selection
│   │   └── download.js   # Blob download trigger
│   └── ui/             # View layer (DOM) — one module per widget
│       ├── dom.js        # Central element registry + status/toast helpers
│       ├── preview.js    # Preview canvas, seeking, live mirror
│       ├── timeline-ui.js # Trim handles, thumbnails, size + GIF warning
│       ├── format.js     # WebM / GIF toggle + settings
│       ├── theme.js      # Light / dark theme
│       ├── countdown.js  # 3-2-1 overlay
│       ├── timer.js      # Recording clock
│       ├── help.js       # Instructions modal
│       └── starfield.js  # Background animation
├── manifest.json       # PWA manifest
├── sw.js               # Service worker — cache-first offline support
└── icon.svg            # App icon
```

The split leans toward a hexagonal shape: `domain/` is pure, `infra/` and `ui/`
are adapters, and `recorder.js` / `exporter.js` are the use cases that
`main.js` composes. It uses native ES modules, so there is still no build step.

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

1. Fork or clone this repo
2. Go to **Settings → Pages → Source → main branch / root**
3. Your instance will be live at `https://<your-username>.github.io/orbit-capture/`

No build step. No dependencies to install.

---

## Tech

- [`MediaDevices.getDisplayMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia) — screen capture
- [`MediaRecorder`](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) — WebM encoding
- [`gif.js`](https://github.com/jnordberg/gif.js) — GIF encoding via Web Workers
- [Syne](https://fonts.google.com/specimen/Syne) + [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) — typefaces
- Service Worker + Web App Manifest — PWA support

---

## License

MIT
