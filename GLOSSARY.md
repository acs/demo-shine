# Glossary

The words this project uses, and what they mean. This is the base of the
*ubiquitous language*: the code, the commits, the pull requests and the interface
should all use these words, and use them for the same things.

If a concept is missing, name it here **first**. If a word in the code disagrees
with one here, one of the two is wrong — and it is worth fixing then rather than
later. (This file exists because "take" and "part" were both in the code for the
same thing, which cost a rename across nine modules to undo.)

## The recording

| word | what it is | where |
|---|---|---|
| **session** | the recordings made since the app started, or since the last Reset. One session, one clip | `resetAll()`, `clip.clear()` |
| **take** | **one press of Record**: one MediaRecorder WebM with its own length, played in order with the others | `Take` — id, blob, url, duration |
| **clip** | all the takes, in order, plus the keep range and what was trimmed away. What the app asks what to show and what to export | `Clip`, the aggregate |
| **join** | the seam where one take ends and the next begins. Where the sound fades and the picture dissolves | `FADE_S`, `DISSOLVE_S` |

A clip's length is **the sum of its takes** — derived, never a field beside them.

## Trimming

| word | what it is | where |
|---|---|---|
| **mark** | a position on the clip placed by a click, as a fraction (0..1). Two marks bound a section. **View state, not the clip's** | `app.marks` |
| **section** | the region the two marks bound — what the user is about to trim. A proposal: nothing has left the clip yet | `pendingRegion()` |
| **cut** *(removed region)* | a section that was **approved**: it has left the timeline, and is skipped on playback and on export | `clip.cuts`, a `SpanSet` |
| **keep range** *(also: trim, IN–OUT)* | the range that is kept, dragged with the two handles, as a fraction of the clip | `clip.trim`, a `Trim` |
| **span** | a range, half-open: `[s, e)`. The smallest thing the timeline is made of | `Span` |
| **timeline** | the strip under the preview, drawn in **kept time** — a trimmed-away stretch has no width on it | `timeline-ui.ts` |
| **recording time** | where a moment is *in the recording* | `TimelineMap.sourceOf()` |
| **kept time** | where that moment *appears on the timeline* | `TimelineMap.keptOf()` |

`TimelineMap` is the only place that converts between recording time and kept
time. Passing one where the other was meant is the mistake it exists to prevent.

## Exporting

| word | what it is | where |
|---|---|---|
| **segment** | a kept stretch of **one take**, in seconds: `{ takeIndex, from, to }`. What an export is made of | `clip.segmentsIn()` |
| **export** | writing the kept range as a single WebM, with the joins faded and dissolved | `doExport()` (use case), `exportOffline()` (adapter) |
| **fade** | the sound going down over the last 80 ms of a take and back up as the next begins | `FADE_S` |
| **dissolve** | the picture blending from the last frame of a take into the first frames of the next, over the same 80 ms | `DISSOLVE_S` |
| **crop region** | the rectangle of the screen being recorded — the red box — as fractions of the capture | `app.region` |

## Words we do not use

- **part** — an old name for a **take**. Gone from the code except one comment
  that records why the take repository exists.
- **region** for a removed area — a region is the **crop**. A removed area is a
  **cut**.
- **real-time export** — the path that played the clip and recorded the canvas.
  Removed; the export is encoded offline (`git show f73a121`).

## Keeping it alive

- A new concept starts here, in a sentence, before it starts in the code.
- Changed meaning: change the code and the words **together**, in one rename
  commit. A word that lingers is worse than a wrong one, because it hides that
  two names mean the same thing.
- The interface is bound by this too: the README, the help panel and the status
  messages use these words, and the help panel is written for the person using
  the app rather than for us.
