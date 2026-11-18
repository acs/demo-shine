<h1>
  <img src="public/branding/logo.png" alt="DemoClip" width="420">
</h1>

**🚀 Live App**: [https://acs.github.io/democlip/](https://acs.github.io/democlip/)

Capture. Create. Share.

DemoClip is a lightweight video studio that runs entirely in your browser. Record your screen, webcam or microphone — independently or in any combination — to create software demos, tutorials or personal video updates.

Review your recordings, make quick cuts, and publish directly to Bluesky. Or simply export your video to a file.

No installation. No recording server. Just open DemoClip and start creating.

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF)](https://vite.dev/)
[![Vitest](https://img.shields.io/badge/Vitest-5-6E9F18)](https://vitest.dev/)
[![ESLint](https://img.shields.io/badge/ESLint-10-4B32C3)](https://eslint.org/)
[![WebCodecs](https://img.shields.io/badge/WebCodecs-export-1B7F79)](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
[![Mediabunny](https://img.shields.io/badge/Mediabunny-1.66-6E56CF)](https://mediabunny.dev/)
[![PWA](https://img.shields.io/badge/PWA-offline-5A0FC8)](https://web.dev/progressive-web-apps/)
[![Bluesky](https://img.shields.io/badge/Bluesky-AT_Protocol-0285FF)](https://atproto.com/)

A minute and a half of DemoClip recording, cutting and exporting a clip — recorded with DemoClip itself:

https://github.com/user-attachments/assets/81f83dc4-a036-4e10-a398-b36ceca93122

---

## Features

The headline capabilities; the **[full list is in FEATURES.md](FEATURES.md)**.

- **Screen, webcam and mic** — record a screen, window or tab with its audio, the camera, the microphone, or any combination of them
- **Nothing captured until you ask** — every source starts off, so the app never opens a screen picker on its own
- **Region crop** — drag a box over the preview to record just part of the screen, and click to reset
- **Timeline cutting** — click twice to select a section, cut it out with the scissors, and undo it
- **Add more takes** — Record again appends to the end of the clip, with a fade and a dissolve across the join
- **Export to a file, encoded offline** — WebM for size or MP4 for compatibility, written in the browser by WebCodecs about 10× faster than the clip, with a duration and cue points any player can scrub
- **Nothing leaves your machine** — recording, playback and export are entirely local; publishing to Bluesky is optional, and only happens when you ask
- **Light / dark and installable** — CSS-variable theming, and a PWA that installs as a desktop app

---

## Usage

1. Open [DemoClip](https://acs.github.io/democlip/) — nothing is captured yet. Press **Screen** to pick a screen, window or tab (full screen is preselected; tick **Share tab audio** / **Share system audio** for sound), or **Webcam** to record the camera on its own — **Mic** adds the microphone to either. Pressing a source again lets it go, and **New** goes back to the picker if you forget the audio
2. The red box over the preview shows what will be recorded — the whole screen by default; drag to record only a region, and click to go back to the full screen
3. Press the red button to record — it starts at once; press it again to stop
4. Press Record again to add another take to the end of the clip — the timeline then holds every take, and the cuts you already made are kept
5. The timeline holds a playback control and an audio track
6. Play it back (**P** or ▶), or click anywhere on the timeline to bring the playhead there — it holds the frame rather than playing, so you can find the exact moment. To cut a section out, click where it starts and where it ends, then press the **scissors** (or click inside the shaded section): it leaves the timeline and the rest closes up. The **undo** on the section drops the selection, and the **undo** in the header brings back what you just cut. Marks and the selected section can be dragged to reposition them, with the frame under them following, or nudged a frame at a time with **←** / **→** (hold **Shift** for a second)
7. Press **Export ▾** and pick where the clip goes — a **WebM** file (small and sharp), an **MP4** file (plays anywhere), or **Bluesky** to publish it as a video post. The encode runs offline, over the clip with its cuts taken out, roughly ten times faster than the clip, and the timeline counts down how much is left to write

---

## File structure

```
democlip/
├── index.html            # Entry HTML — links the stylesheet and src/main.ts
├── styles.css            # All styling (theme variables, layout, components)
├── src/                  # TypeScript source
│   ├── main.ts           # Composition root — wires the UI to the flows
│   ├── session.ts        # The session: the clip and the view state, and the one place that lets go of it
│   ├── state.ts          # Shared mutable state — deliberately small; the model lives in domain/
│   ├── prefs.ts          # User preferences (localStorage)
│   ├── recorder.ts       # The recording flow (getDisplayMedia + MediaRecorder) — needs a real picker
│   ├── exporter.ts       # The export and new-session flows: buttons, status line, phase
│   ├── resume.ts         # Keeping the clip across a page load: write it down, read it back
│   ├── offline-export.ts # The export's browser half: decode, draw, encode, mux
│   ├── util.ts           # Tiny shared helpers (clampToClip)
│   ├── globals.d.ts      # Ambient types (prefixed AudioContext, captureStream)
│   ├── vite-env.d.ts     # Vite client types
│   ├── domain/clip/      # Pure logic — no DOM, no browser APIs; a test beside every rule
│   │   ├── Clip.ts         # The aggregate: takes + cuts + the kept segments
│   │   ├── Take.ts         # One press of Record: id, blob, url, duration
│   │   ├── TakeRepository.ts # The port the clip takes its takes from
│   │   ├── Span.ts         # A half-open range: [s, e)
│   │   ├── SpanSet.ts      # Ranges that cannot overlap — what was cut
│   │   ├── TimelineMap.ts  # Recording time ↔ kept time, in one place
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
│   │   ├── clip-store.ts   # IndexedDB — where a clip outlives the page
│   │   ├── codecs.ts       # WebM mime / codec selection
│   │   ├── export-target.ts # which container an export writes (WebM, MP4) and its codecs
│   │   ├── bluesky.ts      # the OAuth session + XRPC calls; loaded only when publishing
│   │   └── download.ts     # Blob download trigger
│   └── ui/               # View layer (DOM) — one module per widget, each exporting the object its state lives on
│       ├── dom.ts          # Central element registry + status/toast helpers
│       ├── preview.ts      # Preview canvas, seeking, live mirror
│       ├── region.ts       # Crop-region selection + overlay (CropDrag)
│       ├── timeline-ui.ts  # Time labels, size estimate, the thumbnail strip (Strip)
│       ├── live-timeline.ts # The strip and the levels while a take records (LiveTimeline)
│       ├── thumbnail.ts    # The shape of a strip cell: a frame at the picture's own aspect
│       ├── clip.ts         # The joined clip, played as one timeline (Player)
│       ├── marks.ts        # Marks and sections: click, drag (MarkDrag), overlay
│       ├── playback.ts     # Playback on the preview, skipping the cuts (Playback)
│       ├── fade.ts         # Short fades at the joins between takes
│       ├── dissolve.ts     # Short dissolves at the joins between takes (Dissolve)
│       ├── waveform.ts     # The audio track under the strip (Waveform)
│       ├── size-estimate.ts # What the export will weigh
│       ├── mic.ts          # Microphone capture + level meter (Meter)
│       ├── webcam.ts       # The webcam source: a bubble, or the whole picture
│       ├── source-buttons.ts # The source buttons' enabled state
│       ├── theme.ts        # Light / dark theme
│       ├── help.ts         # Instructions modal
│       └── version.ts      # The version badge, and the newer-build offer
├── public/               # Copied verbatim into the build
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service worker — cache-first offline support
│   ├── oauth-client-metadata.json # the Bluesky OAuth client_id document
│   └── branding/           # Logo (with background, transparent, dark), icon-only mark, app icons
├── vite.config.ts        # Dev server + build config
├── tsconfig.json         # TypeScript config (type-check / editor)
├── eslint.config.js      # ESLint (flat config)
├── vitest.config.ts      # Test runner config
├── VERSIONING.md         # How the version is bumped, tagged and shown
├── FEATURES.md           # Every feature in full — the README keeps the summary
├── GLOSSARY.md           # The words this project uses — the ubiquitous language
├── THIRD-PARTY-NOTICES.template.txt  # Licences of what we bundle; the build fills in the versions
├── .agents/skills/       # How work is done here: verifying a change, the domain model, the workflow, branding
└── .husky/pre-commit     # Runs lint-staged on commit
```

The split is a hexagonal one: `domain/` is pure and `application/` holds the
use cases (both run in node, with tests beside them), `infra/` and `ui/` are the
adapters that reach the browser and the DOM, and `recorder.ts` / `exporter.ts` /
`resume.ts` are the flows that `main.ts` composes. Each `ui/` module exports the object its state
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
| `npm run dev` | Starts the Vite dev server at **http://127.0.0.1:5173** — plain HTTP on a loopback host — with hot module replacement |
| `npm run dev:https` | The same over HTTPS with a self-signed certificate, for what needs a secure origin |
| `npm run build` | Type-checks and builds the production site into `dist/` |
| `npm run preview` | Serves the built site (`dist/`) over plain HTTP on 127.0.0.1, with the PWA/service worker active |
| `npm run preview:https` | The same over HTTPS |
| `npm run typecheck` | Type-checks without emitting |
| `npm run lint` | ESLint (use `npm run lint:fix` to auto-fix) |
| `npm test` | Runs the Vitest unit tests (`npm run test:watch` to watch) |

The dev server disables the service worker — its cache-first strategy would
shadow HMR — so use `npm run preview` to exercise the real PWA locally.

HTTPS is one flag away — `npm run dev:https`, and `preview:https` — using a
self-signed certificate from `@vitejs/plugin-basic-ssl`. Browsers warn until that
certificate is trusted, and the service worker will not register on an untrusted
one — so trust it (add it to your keychain) if you need HTTPS for install or
offline testing.

Plain HTTP is the default for both servers, on `127.0.0.1`. That is a **secure
context** already, so screen capture works, and it is the only origin atproto's
OAuth allows a dev server to sign in from — which is how publishing to Bluesky is
tested without deploying anything, and without a tunnel. The app still redirects any
`http://` access to `https://` except on a loopback host, so a deployment reached
over http is upgraded.

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
belongs), the [workflow](.agents/skills/project-workflow/SKILL.md) (branches,
commits, pull requests) and [branding](.agents/skills/branding/SKILL.md) (the mark,
the name and the colours).

---

## Browser support

| Browser | Screen capture | Screen audio | Webcam & mic | Export |
|---|---|---|---|---|
| Chrome 94+ · Edge 94+ | ✓ | ✓ | ✓ | ✓ |
| Firefox 130+ | ✓ | ✗ | ✓ | ✓ |
| Safari 26+ (macOS) | ✓ | ✗ | ✓ | ✓ |
| Chrome (Android) | ✗ | ✗ | ✓ | ✓ |
| Firefox (Android) | ✗ | ✗ | ✓ | ✗ |
| Safari (iOS 27+) | ✓ | ✗ | ✓ | ✓ |

Screen capture needs `getDisplayMedia`. **No mobile browser had it until Safari 27
on iOS** — Chrome and Firefox on Android still cannot share a screen. A phone or
tablet records the **webcam and the microphone** instead, with the same timeline,
cutting and export; the Screen button is out there, and the header says why.

The export needs WebCodecs (`VideoEncoder` and `AudioEncoder`): Chrome and Edge
94+, Firefox 130+ and Safari 26+. **Firefox 113–129 can record but not export** —
it arrived in Firefox 130 — and Firefox on Android cannot export at all. There is
no slower path to fall back to any more, and the app says so rather than failing
halfway.

Screen audio is Chrome and Edge only, and even there the browser and the
operating system decide: Windows and ChromeOS offer system audio, elsewhere it is
the shared tab's own sound. The microphone is unaffected.

Safari works on the current version — **26 or later**, since WebM recording arrived
in 18.4 and `AudioEncoder` in 26. On macOS the first share also asks for **Screen
Recording** permission in System Settings.

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
- TypeScript — the whole app, unit-tested with [Vitest](https://vitest.dev/) and linted with ESLint
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
