# DemoShine

> Pure browser screen recorder. 100% offline mode — no extensions, no server. Optionally publishes to a video service.

WebM screen recording with region crop, a timeline trimmer, playback with sound, automatic tab/system audio, light/dark mode, and PWA install support — written in TypeScript, tested with Vitest and linted with ESLint.

**[→ Launch DemoShine](https://acs.github.io/demo-shine/)**

---

## Features

- **Zero dependencies on your machine** — runs entirely in the browser via `getDisplayMedia`
- **Live preview on start** — the screen capture begins as soon as the app opens (full screen preferred), no need to press record first
- **WebM export, encoded offline** — VP9 (VP8 fallback) with Opus audio, written straight from the decoded frames by WebCodecs: about **10× faster than the clip**, it keeps going while the tab is in the background, and the file carries a duration and cue points, so any player can scrub it
- **Region crop** — a red box over the preview always shows what will be recorded: the whole screen by default, drag to record just part of it, click to reset; while recording the box breathes (red ↔ background)
- **Webcam overlay** — a header toggle adds a mirrored webcam bubble in the corner of the recording (disabled when no camera is present)
- **Microphone** — a header toggle (disabled when no mic) with a live level meter; its audio is **mixed with the tab/system audio** in the recording
- **Add more takes** — pressing Record after a recording appends the new one to the end of the clip; the share is kept between takes, so there is no second picker and **every take in a clip comes from the same source** (the same tab, window or screen). **A short fade either side of the join, and a dissolve across it**, soften the change from one take to the next. Reset starts a new clip; if the share ends, Record asks for another one and the next take still adds on
- **Live timeline** — the timeline is there while a take records, filling in with the picture and the sound as they are captured (drawn from the live preview and the recorded stream's own levels, never by decoding the half-written file), and it becomes the trim timeline on stop
- **Timeline trimmer** — drag IN/OUT handles to keep a range, then **click twice to select a section and approve it with the green check** (or by clicking inside it), with a **red cross** to leave it in and an **undo** to put it back. **An approved trim leaves the timeline**, which closes up over it, so the timeline always shows what the export will hold — the strip, the waveform, the handles and the playhead all follow. **Drag a mark or the selected section** (whole, or by an edge) to reposition it, with the clip playing under it as it moves
- **Playback** — play the recorded clip back on the preview with sound, bounded by the IN/OUT handles
- **Export progress on the timeline** — the playhead travels across the clip as it is written, with the frames shown on the preview and how much of the clip is left to write counted down; nothing runs off a bottom bar
- **Audio track** — a waveform of the recording under the thumbnails, shown when the clip has sound
- **3-second countdown** — the live preview stays visible behind it, and pressing record again during it cancels
- **Tab / system audio** — requested on every capture (`audio: true` plus Chrome's `systemAudio: 'include'` hint, so the audio option is offered); the browser owns that checkbox, so the app says so when a share comes back silent, and **Reset** returns to the picker to redo it
- **Light / dark mode** — full CSS variable theming, persisted to `localStorage`
- **PWA** — installable as a desktop app, offline-capable for core recording and WebM export
- **Version on screen** — the deployed build's version sits beside the logo (in the help panel too), and when a newer build has been deployed the header offers a reload; every merge to `main` bumps it, tags it and deploys — see [VERSIONING.md](VERSIONING.md)
- **100% offline mode** — recording, playback and export happen entirely in your browser, and nothing is uploaded or stored on a server. Publishing a clip to a video service is optional, and only happens when you ask

---

## Usage

1. Open [DemoShine](https://acs.github.io/demo-shine/) in Chrome or Edge — the picker opens straight away and the screen goes live in the preview (full screen is preselected; tick **Share tab audio** / **Share system audio** for sound, and press **Reset** to go back to the picker if you forget)
2. The red box over the preview shows what will be recorded — the whole screen by default; drag to record only a region, and click to go back to the full screen
3. Press the red button to record — a 3-second countdown runs, and pressing the button again during it cancels; press it again to stop
4. Press Record again to add another take to the end of the clip — the timeline then holds every take, and the trims you already made are kept
5. The timeline holds a playback control and an audio track
6. Play it back, drag the **blue IN** and **red OUT** handles to keep a range, or click anywhere on the timeline to play from that moment. To cut a section out, click where it starts and where it ends, then press the **green check** (or click inside the shaded section): it leaves the timeline and the rest closes up. The **red cross** leaves the section in, and the small **undo** arrow brings back what you just trimmed. Marks and the selected section can be dragged to reposition them
7. Click **Export ↓** to encode and download — the timeline fills as it writes and counts down how much of the clip is left to write (it is encoded offline, over the kept range only, roughly ten times faster than the clip)

---

## File structure

```
demoshine/
├── index.html            # Entry HTML — links the stylesheet and src/main.ts
├── styles.css            # All styling (theme variables, layout, components)
├── src/                  # TypeScript source
│   ├── main.ts           # Composition root — wires the UI to the flows
│   ├── session.ts        # The session: the clip and the view state, and the one place that lets go of it
│   ├── state.ts          # Shared mutable state — deliberately small; the model lives in domain/
│   ├── prefs.ts          # User preferences (localStorage)
│   ├── recorder.ts       # The recording flow (getDisplayMedia + MediaRecorder) — needs a real picker
│   ├── exporter.ts       # The export and reset flows: buttons, status line, phase
│   ├── offline-export.ts # The export's browser half: decode, draw, encode, mux
│   ├── util.ts           # Tiny shared helpers (sleep)
│   ├── globals.d.ts      # Ambient types (prefixed AudioContext, captureStream)
│   ├── vite-env.d.ts     # Vite client types
│   ├── domain/clip/      # Pure logic — no DOM, no browser APIs; a test beside every rule
│   │   ├── Clip.ts         # The aggregate: takes + keep range + cuts + the kept segments
│   │   ├── Take.ts         # One press of Record: id, blob, url, duration
│   │   ├── TakeRepository.ts # The port the clip takes its takes from
│   │   ├── Span.ts         # A half-open range: [s, e)
│   │   ├── SpanSet.ts      # Ranges that cannot overlap — what was cut
│   │   ├── TimelineMap.ts  # Recording time ↔ kept time, in one place
│   │   ├── Trim.ts         # The keep range, and the slider view of it
│   │   └── ExportPlan.ts   # What the file will hold, decided before a frame is encoded
│   ├── domain/bluesky/   # Pure logic for publishing: what a Bluesky post may hold
│   │   ├── AspectRatio.ts  # width:height, whole numbers, reducible to smallest terms
│   │   ├── PublishableVideo.ts # the MP4 Bluesky takes, up to 300 MB
│   │   └── BlueskyPost.ts  # the app.bsky.feed.post record carrying the video embed
│   ├── application/      # Use cases: the thinking, without a browser
│   │   ├── export-clip.ts  # planExport(clip, settings) → an ExportPlan
│   │   ├── publish-to-bluesky.ts # publishToBluesky(clip, settings, deps) → a post
│   │   └── bluesky-service.ts # the port the publish use case reaches Bluesky through
│   ├── infra/            # Browser boundary adapters
│   │   ├── takes.ts        # InMemoryTakeRepository — owns the takes' object URLs
│   │   ├── codecs.ts       # WebM mime / codec selection
│   │   ├── export-target.ts # which container an export writes (WebM, MP4) and its codecs
│   │   ├── bluesky.ts      # the OAuth session + XRPC calls; loaded only when publishing
│   │   └── download.ts     # Blob download trigger
│   └── ui/               # View layer (DOM) — one module per widget, each exporting the object its state lives on
│       ├── dom.ts          # Central element registry + status/toast helpers
│       ├── preview.ts      # Preview canvas, seeking, live mirror
│       ├── region.ts       # Crop-region selection + overlay (CropDrag)
│       ├── timeline-ui.ts  # IN/OUT handles, size estimate, the thumbnail strip (Strip)
│       ├── live-timeline.ts # The strip and the levels while a take records (LiveTimeline)
│       ├── clip.ts         # The joined clip, played as one timeline (Player)
│       ├── marks.ts        # Marks and sections: click, drag (MarkDrag), overlay
│       ├── playback.ts     # Playback on the preview, skipping the cuts (Playback)
│       ├── fade.ts         # Short fades at the joins between takes
│       ├── dissolve.ts     # Short dissolves at the joins between takes (Dissolve)
│       ├── waveform.ts     # The audio track under the strip (Waveform)
│       ├── size-estimate.ts # What the export will weigh
│       ├── timer.ts        # Recording clock
│       ├── countdown.ts    # The 3-2-1 overlay, cancellable (Countdown)
│       ├── mic.ts          # Microphone capture + level meter (Meter)
│       ├── webcam.ts       # Webcam bubble overlay
│       ├── theme.ts        # Light / dark theme
│       ├── help.ts         # Instructions modal
│       ├── version.ts      # The version badge, and the newer-build offer
│       └── starfield.ts    # Background animation
├── public/               # Copied verbatim into the build
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service worker — cache-first offline support
│   ├── oauth-client-metadata.json # the Bluesky OAuth client_id document
│   └── icon.svg            # App icon
├── vite.config.ts        # Dev server + build config
├── tsconfig.json         # TypeScript config (type-check / editor)
├── eslint.config.js      # ESLint (flat config)
├── vitest.config.ts      # Test runner config
├── VERSIONING.md         # How the version is bumped, tagged and shown
├── GLOSSARY.md           # The words this project uses — the ubiquitous language
├── THIRD-PARTY-NOTICES.template.txt  # Licences of what we bundle; the build fills in the versions
├── .agents/skills/       # How work is done here: verifying a change, the domain model, the workflow
└── .husky/pre-commit     # Runs lint-staged on commit
```

The split is a hexagonal one: `domain/` is pure and `application/` holds the
use cases (both run in node, with tests beside them), `infra/` and `ui/` are the
adapters that reach the browser and the DOM, and `recorder.ts` / `exporter.ts` are
the flows that `main.ts` composes. Each `ui/` module exports the object its state
lives on, and `session.ts` is what ends those lifetimes — the vocabulary is in
[GLOSSARY.md](GLOSSARY.md), and where a rule belongs is in
[`.agents/skills/domain-model`](.agents/skills/domain-model/SKILL.md). It is
written in TypeScript and served and bundled by [Vite](https://vite.dev/).


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

Unit tests live beside the rules they prove (`src/domain/`, `src/application/`);
anything drawn, played or encoded is proven by a temporary browser harness on the
dev server instead. What counts as proof, and what to say about what you could not
check, is in [`.agents/skills/verification`](.agents/skills/verification/SKILL.md).

**How the project is worked on is written down**, so it does not have to be
rediscovered: [`GLOSSARY.md`](GLOSSARY.md) holds the words — a *take* is not a
*mark*, a *section* is not yet a *cut* — and `.agents/skills/` holds
[verification](.agents/skills/verification/SKILL.md) (what counts as proving a
change), the [domain model](.agents/skills/domain-model/SKILL.md) (where a rule
belongs) and the [workflow](.agents/skills/project-workflow/SKILL.md) (branches,
commits, pull requests).

---

## Browser support

| Browser | Recording | WebM export | Audio |
|---|---|---|---|
| Chrome 94+ | ✓ | ✓ | ✓ |
| Edge 94+ | ✓ | ✓ | ✓ |
| Firefox 130+ | ✓ | ✓ | Partial |
| Safari | ✗ | — | — |

Safari does not support `getDisplayMedia` for screen capture.

The export needs WebCodecs (`VideoEncoder`), so **Firefox 113–129 can record but
not export** — it arrived in Firefox 130. There is no slower path to fall back to
any more, and the app says so rather than failing halfway.

---

## Deploy your own

A PWA has to be served over HTTP(S) from an origin — opening `index.html` from
disk will not register the service worker (it needs a secure context).

Pushing to `main` runs the **Deploy** workflow, which runs `npm run build` and
publishes `dist/` to GitHub Pages. Enable it once in
**Settings → Pages → Source → GitHub Actions** (the workflow also attempts to
enable Pages itself).

The same workflow bumps the patch version, tags it and commits it back to `main`,
so every deploy has its own number beside the logo — see
[VERSIONING.md](VERSIONING.md).

To deploy elsewhere, run `npm run build` and publish the `dist/` folder.

---

## Tech

- [Vite](https://vite.dev/) — dev server and build
- [`MediaDevices.getDisplayMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia) — screen capture
- [`MediaRecorder`](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) — WebM encoding as a take is recorded
- [WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) — `VideoEncoder`/`AudioEncoder` for the offline export
- [Mediabunny](https://mediabunny.dev/) — reads the takes back frame by frame for that export, and writes the exported file, duration and cue points included
- Bundled licences — filled at build time from `THIRD-PARTY-NOTICES.template.txt`, carried inside the JS bundle and served beside the app as `THIRD-PARTY-NOTICES.txt`
- [Syne](https://fonts.google.com/specimen/Syne) + [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) — typefaces
- Service Worker + Web App Manifest — PWA support

---

## License

MIT — see [LICENSE.md](LICENSE.md).
