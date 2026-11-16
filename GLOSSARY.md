# Glossary

The words this project uses, and what they mean. This is the base of the
*ubiquitous language*: the code, the commits, the pull requests and the interface
should all use these words, and use them for the same things.

If a concept is missing, name it here **first**. If a word in the code disagrees
with one here, one of the two is wrong — and it is worth fixing then rather than
later. (This file exists because "take" and "part" were both in the code for the
same thing, which cost a rename across nine modules to undo.)

A concept that needs rules is a **class named after the word**, and the third
column says which. The ones that hold rules and relate others are **aggregates** —
`Clip` is the one the app is built around — and every rule in `domain/` has a test
beside it.

## The recording

| word | what it is | in the code |
|---|---|---|
| **session** | one sitting of the app: the clip, and the view state that belongs to showing it. Over at Reset, or when the share ends | `Session` (`session.reset()`) |
| **take** | **one press of Record**: one MediaRecorder WebM with its own length, played in order with the others | `Take` — id, blob, url, duration |
| **clip** | all the takes, in order, plus the keep range and what was cut out. What everything else asks what to show and what to export | `Clip`, the aggregate |
| **take repository** | where a clip's takes come from, and the only owner of their object URLs | `TakeRepository` (the port), `InMemoryTakeRepository` |
| **join** | the seam where one take ends and the next begins — where the sound fades and the picture dissolves | `FADE_S`, `DISSOLVE_S` |

A clip's length is **the sum of its takes** — derived, never a field beside them.

## Trimming

| word | what it is | in the code |
|---|---|---|
| **mark** | a position on the clip placed by a click, as a fraction (0..1). Two marks bound a section. **View state, not the clip's** | `app.marks`, read through `pendingSection()` |
| **section** | what the two marks bound — what the user is about to cut out. A proposal: nothing has left the clip yet | `pendingSection()`, a `Span` |
| **cut** | a section that was **approved**: it has left the timeline, and playback and the export skip it | `Clip.cuts`, a `SpanSet` |
| **keep range** *(also: trim, IN–OUT)* | the range that is kept, dragged with the two handles, as a fraction of the clip | `Clip.trim`, a `Trim` |
| **span** | a range, half-open: `[s, e)`. The smallest thing a timeline is made of | `Span` |
| **timeline** | the strip under the preview, drawn in **kept time** — a cut has no width on it | `ui/timeline-ui.ts`, `ui/live-timeline.ts` |
| **recording time** | where a moment is *in the recording* | `TimelineMap.sourceOf()` |
| **kept time** | where that moment *appears on the timeline* | `TimelineMap.keptOf()` |

`TimelineMap` is the only place that converts between recording time and kept
time. Passing one where the other was meant is the mistake it exists to prevent.

## Exporting

| word | what it is | in the code |
|---|---|---|
| **segment** | a kept stretch of **one take**, in seconds: `{ takeIndex, from, to }`. What an export is made of | `Clip.segmentsIn()` |
| **export plan** | the kept stretches placed on the output timeline, with the joins marked where they fall — decided before a frame is encoded, so it can be read and tested without a browser | `ExportPlan`, with `ExportPiece` and `ExportStep` |
| **export** | writing the kept range as a single file — WebM for the download, MP4 (H.264/AAC) for Bluesky — with the joins faded and dissolved | `planExport()` (use case), `exportOffline()` (adapter), driven by `doExport()` (flow) |
| **export target** | which container an export writes — `webm` for the download, `mp4` for Bluesky — and the codecs that follow from it | `ExportTarget`, `specFor()` |
| **fade** | the sound going down over the last 80 ms of a take and back up as the next begins | `FADE_S` |
| **dissolve** | the picture blending from the last frame of a take into the first frames of the next, over the same 80 ms | `DISSOLVE_S` |
| **crop region** | the rectangle of the screen being recorded — the red box — as fractions of the capture | `app.region` |

## Publishing to Bluesky

Publishing takes the export one step further: the kept range is written as **MP4**,
handed to Bluesky's video service, and a post is written that carries the finished
video. Bluesky takes `video/mp4` and nothing else, so this path does not reuse the
WebM download — it encodes its own MP4. Everything that needs the network or an
access token sits behind a port, so the sequencing is tested in node.

| word | what it is | in the code |
|---|---|---|
| **publication** | the clip going to Bluesky: writing the MP4, uploading it, waiting for the video service, and posting | `publishToBluesky()` (use case), `Publication` |
| **publishable video** | the MP4 to upload, with its name and the ratio the post shows it at. Bluesky takes `video/mp4` up to 300 MB | `PublishableVideo` |
| **Bluesky post** | the `app.bsky.feed.post` record that carries the video as an `app.bsky.embed.video` | `BlueskyPost` |
| **video job** | Bluesky's processing of an uploaded video, watched until it hands back the blob | `VideoJob`, `BlueskyService` (the port) |
| **aspect ratio** | the whole-number width:height a post shows its media at | `AspectRatio` |

## The view, and what has a lifetime

Everything else is state that exists for a while and then does not: the strip
while a take records, a gesture in flight, the take the video is holding. Each of
these is an **object rather than a module variable**, so the thing it belongs to
can end it:

| object | what it holds | its lifetime |
|---|---|---|
| `LiveTimeline` | the strip and the levels heard while a take records | a take |
| `Strip` | the thumbnails, taken by seeking the element through the clip | one build — an older one is abandoned rather than left seeking |
| `Player` | which take the video element is showing | the clip being played |
| `Playback` *(the **transport**)* | the seek in flight, the stall watchdog, the fade at a join | the playhead |
| `Waveform` | the bars decoded from the clip's sound | the clip |
| `Dissolve` | the frame held at a join, spent on it | one join |
| `Meter` | the microphone's level graph and its frame loop | the microphone toggle, not the session |
| `Countdown` | the 3-2-1, whether it was cancelled, and where to go back to | one countdown |
| `MarkDrag`, `CropDrag` | a gesture in flight | the gesture |
| `Output`, `Mixer` | the canvas a take is drawn on, and the graph that mixes system audio with the microphone | a take |

`Session` is what ends them: `session.reset()` is the whole of "this session is
over", and the Reset button is only the flow around it.

One module-level `let` is left in `src/` — the toast timer in `ui/dom.ts` — and it
is deliberate: its lifetime is a single toast, not a session.

## Words we do not use

- **part** — an old name for a **take**. Gone from the code except one comment
  that records why the take repository exists.
- **region** for a removed area — a region is the **crop**. A removed area is a
  **cut**.
- **real-time export** — the path that played the clip and recorded the canvas.
  Removed; the export is encoded offline (`git show f73a121`).
- **a flag kept beside the thing it describes** — `countdownAborted` beside the
  countdown's own `cancelled`, `wasCut` beside what the chip already said, a
  `cropRaf` in app state beside the loop that owns it. Ask the object.

## Keeping it alive

- A new concept starts here, in a sentence, before it starts in the code.
- Changed meaning: change the code and the words **together**, in one rename
  commit. A word that lingers is worse than a wrong one, because it hides that
  two names mean the same thing.
- A concept that becomes a class is named after its word; a class that holds rules
  is an aggregate, and its rules are tested beside it.
- The interface is bound by this too: the README, the help panel and the status
  messages use these words, and the help panel is written for the person using the
  app rather than for us.
