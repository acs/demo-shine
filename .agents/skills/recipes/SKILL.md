---
name: Recipes
description: Scenarios DemoClip deliberately does not implement, and how an agent composes them from the app's own operations plus tools outside it — taking the silence out of a clip with ffmpeg, polishing an exported file, pointing at what matters, turning a recording into a post. Use when asked to do something DemoClip has no feature for, before proposing a feature, and when a composition needs writing down or proving.
---

# Recipes

DemoClip's job is to record, cut, annotate, export and publish — and to stay small
enough to keep doing it. Everything else is a **recipe**: a composition of the app's
own operations, driven through the MCP server, with tools outside the app (ffmpeg, a
shell, whatever the machine has) filling in the capability the app deliberately lacks.

A recipe is the alternative to a feature. Adding the scenario to the app would mean
another surface to build, test and carry; composing it costs a paragraph and leaves
the app as it was. So the first question about a scenario is not "how should the app
do this?" but "which operations already compose it?".

The bound is the **tool list** — `mcp/src/tools.ts`, and
`specs/006-democlip-mcp/contracts/mcp-tools.md` for the vocabulary. The agent reaches
the app's own operations and nothing more, so a recipe can compose only what those
expose. When a scenario needs an operation that is not there, that is a **product
decision**: bring the number and the trade, and ask (see the project-workflow skill).

## The seam: analyse outside, edit inside

Put **analysis** outside the app and the **edit** inside it, whenever the recipe can.
The app's edit model is what makes a result non-destructive: a cut is a `Span` in the
clip's `SpanSet`, so it is one `undo` to take back, it re-encodes nothing, and the
export lays its pieces out around it. Anything that instead re-encodes the media
gives that up, so it earns its place only when the app cannot express the edit at all.

| the recipe needs | it belongs to |
|---|---|
| to know something about the media — silence, loudness, a frame | outside: ffmpeg, or a decode in the agent |
| to change the clip | inside: `cut`, `annotate`, `set_property`, `remove_annotation` |
| a kind of change the operations cannot express | neither yet — a product decision |

## Take the silence out

**Goal.** Drop the quiet stretches from a clip, keeping the edit non-destructive.

**Why not a feature.** The app decodes audio to draw its waveform and to build the
export's mix, but it has no silence detection: adding one would put a decode of every
take in the browser, and a threshold to tune, into the app.

**Steps.**
1. `export_clip` — mp4 or webm; the file is what the analysis reads.
2. Find the quiet stretches with ffmpeg, which prints a `silence_start` and
   `silence_end` line, in seconds, for each:
   `ffmpeg -i in.mp4 -af silencedetect=noise=-35dB:d=0.3 -f null -`
3. Turn each stretch into a fraction of the clip — `describe_clip` gives its length —
   and call `cut` once per stretch, **latest first**, so the earlier fractions stay
   valid as the clip shortens.
4. `export_clip` again and re-run the detector: it should find nothing.

**Run once.** A 9.735 s take with a 4.17 s leading silence and a 0.32 s pause
(−35 dB, 0.3 s minimum) cut to a kept length of **5.245 s**, and the detector found
no silence in the re-export. Each cut is one `undo`.

**Caveats.** The threshold is a judgement — a quiet voice loses word edges, so loosen
it (−45 dB) before blaming the cut. The fractions come from the clip's own length
while ffmpeg measures the exported file, so the two differ by the encoder's trim.

## Polish the exported file

**Goal.** Do to the *file* what the app should not: loudness normalisation,
downscaling, a different container.

**Why not a feature.** It is a re-encode, so it is one-way — the result is a new file,
not a new clip — and the app's own export already covers the common case.

**Steps.** `export_clip`, then ffmpeg on the result: `loudnorm` for loudness,
`-vf scale` to resize, `-c copy` to re-container without re-encoding. Nothing comes
back into DemoClip — there is no file source, and adding one is a product decision.

## Point at what matters

**Goal.** A tutorial's arrows and labels, placed by time.

**Steps.** `describe_clip` for the takes and the length, then `annotate` once per
mark — `arrow` with `from` and `to` fractions, or `text` with `x`, `y` and `height` —
each over its own `span`. `set_property` colours one, `remove_annotation` takes it
back. The marks are the app's, so they play back, export and undo like any other.

## Turn a recording into a post

**Goal.** A short clip, published.

**Steps.** `describe_clip`, `cut` the stretches that do not earn their place, `seek`
to a moment to check it, then `publish_clip` with `text` and `alt` — from the account
signed in in that window. A `publish_clip` with nobody signed in is refused, and
nothing leaves the machine.

## Writing a recipe down

A recipe is worth writing only once it has been **run**. Say the level of proof it got
in the verification skill's terms, and record the number that mattered — the duration,
the ratio, the byte size. A recipe that was reasoned about but never run says so.

Keep the app's vocabulary: name each operation as the tools name it, so a reader can
follow the recipe in a chat and recognise every step.

## Where a recipe travels

These files are already in the format MCP reads: a directory holding a `SKILL.md`
whose frontmatter carries `name` and `description`, with anything else referenced
relative to it. MCP's **Skills over MCP** extension
(`io.modelcontextprotocol/skills`, SEP-2640, Beta) serves exactly that shape over the
existing `resources` primitive, discovered through `skills/list` and `skills/get`, so
a client could load these recipes from the server itself rather than from a checkout.

Serving them is not built yet. A skill is read only by an agent that has it installed,
so today these reach agents working in the repo; reaching the agent driving the app
through MCP is the follow-up this section names.
