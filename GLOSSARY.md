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
| **session** | one sitting of the app: the clip, and the view state that belongs to showing it. Over at **New**, when the clip is exported, or when the share ends | `Session` (`session.reset()`) |
| **take** | **one press of Record**: one MediaRecorder WebM with its own length, played in order with the others | `Take` — id, blob, url, duration |
| **clip** | all the takes, in order, plus what was cut out. What everything else asks what to show and what to export | `Clip`, the aggregate |
| **take repository** | where a clip's takes come from, and the only owner of their object URLs | `TakeRepository` (the port), `InMemoryTakeRepository` |
| **record source** | what a take is made of: the shared **screen**, the **webcam** and the **microphone**. Three independent toggles, **all off at start** — nothing is captured until one is pressed. A take needs a picture: the screen, or the webcam when the screen is off. With the screen off nothing reaches for a share | the source buttons (`#screen-btn`, `#webcam-btn`, `#mic-btn`) |
| **join** | the seam where one take ends and the next begins — where the sound fades and the picture dissolves | `FADE_S`, `DISSOLVE_S` |

A clip's length is **the sum of its takes** — derived, never a field beside them.

## Keeping the recording

A clip lives in the page. The one thing that takes it away is the walk out to
Bluesky to sign in, so the clip is written down before that trip and read back on
the way in — and, because the writing is not only for that trip, a reload or a new
version comes back to it too. The session is over, and the kept copy let go, at
**New** — or when the clip is exported: the file written, or the post published.

A take is megabytes and never changes; the cuts are a few bytes and move on every
cut. They are kept apart, so writing a cut never means writing the recording
again.

| word | what it is | in the code |
|---|---|---|
| **clip snapshot** | everything a clip is made of, written down: its takes (the recording bytes and their lengths) and its cuts | `ClipSnapshot`, `Clip.snapshot()` |
| **restore** | rebuilding a clip from a snapshot and opening the review on it. Nothing is announced: it is a load, not a change | `Clip.restore()`, `resumeClip()` |
| **clip store** | where a snapshot outlives the page: IndexedDB, the only store here that takes a Blob. A take is written once as it arrives; the cuts are written on their own. Read at startup, dropped when the session ends | `src/infra/clip-store.ts`, `src/resume.ts` |

## Cutting

| word | what it is | in the code |
|---|---|---|
| **mark** | a position on the clip placed by a click, as a fraction (0..1). Two marks bound a section. **View state, not the clip's** | `selection.marks`, read through `selection.section()` |
| **section** | what the two marks bound — the stretch the user is pointing at, about to be cut out or annotated. A proposal: nothing has left the clip yet | `selection.section()`, a `Span` |
| **selection** | the stretch the user is pointing at: the two marks and the section they bound. An action is chosen for it — cut it, or annotate it | `ui/cutting/selection.ts` |
| **cut** | a section that was **approved**: it has left the timeline, and playback and the export skip it | `Clip.cuts`, a `SpanSet` |
| **span** | a range, half-open: `[s, e)`. The smallest thing a timeline is made of | `Span` |
| **timeline** | the strip under the preview, drawn in **kept time** — a cut has no width on it | `ui/clip/timeline-ui.ts`, `ui/recording/live-timeline.ts` |
| **thumbnail** | one cell of the strip: a small picture of a frame, at the take's own shape. A crop's picture is not 16:9, and stretching it into a fixed cell would show a picture the clip does not hold | `thumbBox()`, `drawThumb()` in `ui/clip/thumbnail.ts` |
| **recording time** | where a moment is *in the recording* | `TimelineMap.sourceOf()` |
| **kept time** | where that moment *appears on the timeline* | `TimelineMap.keptOf()` |

`TimelineMap` is the only place that converts between recording time and kept
time. Passing one where the other was meant is the mistake it exists to prevent.

## Annotating

Something drawn over the picture, for a stretch of the clip's time. The first kind
is the **arrow**; the family is built so the next kind is added by describing it,
not by reworking the arrow. The stretch is chosen with the **selection** — the same
one a cut is approved from — so there is one way to point at a stretch of the clip,
whatever is then done with it.

| word | what it is | in the code |
|---|---|---|
| **annotation** | something drawn over the picture of a clip, for a stretch of its time. It has a **kind**, the **span** it is shown over, and a geometry its kind shapes | `Annotation`, `Clip.annotations` |
| **annotation kind** | what makes one annotation different from another — an arrow today. Its rules (how a geometry is normalised, whether it is worth keeping) live in the domain; how it is drawn and picked lives in the view, under the same id | `AnnotationKind`, `kinds.ts`; `AnnotationRenderer`, `ui/annotating/annotation-layer.ts` |
| **arrow** | the first kind: a line with a head, given by where it starts (`from`) and what it points at (`to`), in fractions of the picture | `arrowKind`, `ArrowGeometry` |
| **annotation lane** | the row on the timeline marking each annotation at the start of its stretch, in kept time, so one can be found without playing the clip | `ui/annotating/annotation-lane.ts` |
| **annotation layer** | the one place an annotation is drawn, used by playback and by the export alike, so the file matches the review | `ui/annotating/annotation-layer.ts` |

An annotation's geometry is held in fractions of the picture, so it lands in the
same place on the preview, on the export canvas and after a reload. A **cut takes
its part of an annotation's stretch with it** — the moment is gone from the
timeline, so nothing is drawn there — and putting the cut back brings it back.

## Exporting

| word | what it is | in the code |
|---|---|---|
| **segment** | a kept stretch of **one take**, in seconds: `{ takeIndex, from, to }`. What an export is made of | `Clip.segmentsIn()` |
| **export plan** | the kept stretches placed on the output timeline, with the joins marked where they fall — decided before a frame is encoded, so it can be read and tested without a browser | `ExportPlan`, with `ExportPiece` and `ExportStep` |
| **export** | writing the kept clip as a single file — WebM for the download, MP4 (H.264/AAC) for Bluesky — with the joins faded and dissolved | `planExport()` (use case), `exportOffline()` (adapter), driven by `doExport()` (flow) |
| **export target** | which container an export writes — `webm` for the download, `mp4` for Bluesky — the codecs that follow from it, and **the picture** the encoder is given, which is the crop's own except that H.264 refuses an odd edge and is taken down to even | `ExportTarget`, `specFor()`, `evenPicture()` |
| **fade** | the sound going down over the last 80 ms of a take and back up as the next begins | `FADE_S` |
| **dissolve** | the picture blending from the last frame of a take into the first frames of the next, over the same 80 ms | `DISSOLVE_S` |
| **crop region** | the rectangle of the screen being recorded — the red box — as fractions of the capture. A region stays inside the picture and is never empty | `CropRegion` (`src/domain/capture/CropRegion.ts`) |

## Publishing to Bluesky

Publishing takes the export one step further: the kept clip is written as **MP4**,
handed to Bluesky's video service, and a post is written that carries the finished
video. Bluesky takes `video/mp4` and nothing else, so this path does not reuse the
WebM download — it encodes its own MP4. Everything that needs the network or an
access token sits behind a port, so the sequencing is tested in node. The client
that holds the session is loaded only when a sign-in comes back or a clip is
published, so a normal load carries none of it.

Bluesky's own limits — ten minutes and 300 MB — are **Bluesky's**, and only this
path knows them: nothing limits a recording, the timeline, or an export to a file.
A clip too long to publish is refused here before anything is encoded, and the
export's bitrate gives way to the size limit rather than the file growing past it.

| word | what it is | in the code |
|---|---|---|
| **publication** | the clip going to Bluesky: writing the MP4, uploading it, waiting for the video service, and posting | `publishToBluesky()` (use case), `Publication` |
| **publishable video** | the MP4 to upload, with its name and the ratio the post shows it at. Bluesky takes `video/mp4` up to 300 MB | `PublishableVideo` |
| **Bluesky post** | the `app.bsky.feed.post` record that carries the video as an `app.bsky.embed.video` | `BlueskyPost` |
| **video job** | Bluesky's processing of an uploaded video, watched until it hands back the blob | `VideoJob`, `BlueskyService` (the port) |
| **Bluesky client** | where publishing's network lives: the OAuth session, and the XRPC calls the use case needs | `XrpcBlueskyService`, `initBluesky()` |
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
| `ExportMenu` | the File/Bluesky menu under the Export button, and the listeners that end it | one opening |
| `MarkDrag`, `CropDrag` | a gesture in flight | the gesture |
| `Clipboard` | the annotation a copy put aside, for a paste | the session |
| `Output`, `Mixer` | the canvas a take is drawn on, and the graph that mixes system audio with the microphone | a take |

`Session` is what ends them: `session.reset()` is the whole of "this session is
over", and the New button is only the flow around it.

A few spots keep module-level state, all deliberately. The toast timer in
`ui/dom.ts` lasts a single toast. The Bluesky client in `infra/bluesky.ts` — the
OAuth client, the session, and the signed-in handle — lasts the page, because
signing in has to outlive a session reset and be there again on the way back from
the authorization server. The clip store in `infra/clip-store.ts` — its IndexedDB
connection, and the writes queued one behind another — lasts the page too, because
what it holds is the one thing that has to outlive it.

## The architecture

Four layers, and the dependency arrow points inward: `domain/` knows nothing,
`application/` knows the domain, `infra/` and `ui/` know both, and `main.ts`
knows all four. A rule lives in `domain/`; a use case lives in `application/`; a
browser capability sits behind a port; the adapter that implements it lives in
`infra/`; the view that sequences it lives in `ui/`.

| word | what it is | in the code |
|---|---|---|
| **port** | a named browser capability a use case needs, described without the browser. An interface the use case owns | `src/application/ports/` |
| **adapter** | the implementation of a port in the browser boundary. It owns the browser resource it acquires and releases it | `src/infra/` |
| **use case** | a sequence that delivers an outcome — record a take, export a clip, publish a clip, keep a clip, restore a clip. It runs in node with fakes behind its ports | `src/application/` |
| **view flow** | the composition of a use case with the view and the browser: the button, the status line, the phase and the sequencing. It sequences and reports; it holds no rule | `src/ui/*/*-flow.ts` |
| **phase** | the session's state — idle, starting, live, recording, review, encoding. The one piece of genuinely shared state: one owner and one change event | `src/state.ts` |
| **source set** | which of the three record sources are on: screen, webcam, microphone. A take needs a picture: screen or webcam | `SourceSet` (`src/domain/capture/SourceSet.ts`) |
| **session** | one sitting of the app: the clip and the audio flag. It ends on one event — New, an export, a publish, or a share that went away | `Session` (`src/application/session.ts`) |

`ui/` is grouped by the concept it serves: `shell/` the frame, `recording/` a
take, `clip/` the clip and its review, `cutting/` a stretch and its cut,
`annotating/` the drawing, `exporting/` the file, `publishing/` the post,
`keeping/` a kept clip and its restore, and `lifecycle/` the start and end of a
session. `dom.ts` stays at the root as the one registry every group reaches.

## Words we do not use

- **part** — an old name for a **take**. Gone from the code except one comment
  that records why the take repository exists.
- **region** for a removed area — a region is the **crop**. A removed area is a
  **cut**.
- **trim** — what the UI used to call a **cut**: the label, the chip, the events
  `trim-approved` / `trim-undone`. The domain always said `Clip.cuts`, and the
  words are one again: a **cut** is the stretch removed and the act of removing it.
- **keep range**, **trim handles**, **IN/OUT** — the range a clip kept, dragged
  with two sliders. The **cut** does the same job, so it was removed with
  `Trim.ts` and the two range inputs.
- **real-time export** — the path that played the clip and recorded the canvas.
  Removed; the export is encoded offline (`git show f73a121`).
- **a flag kept beside the thing it describes** — `wasCut` beside what the chip
  already said, a `cropRaf` in app state beside the loop that owns it. Ask the
  object.

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
