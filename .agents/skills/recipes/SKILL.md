---
name: Recipes
description: Workflows DemoClip deliberately does not implement, and how an agent composes them from the app's own operations plus tools outside it — the rules for a recipe, and an index of the ones written down. Read this first, then only the recipe you need.
---

# Recipes

DemoClip's job is to record, cut, annotate, export and publish — and to stay small
enough to keep doing it. Everything else is a **recipe**: a workflow the app cannot
finish on its own, composed from the app's own operations, driven through the MCP
server, with tools outside the app (ffmpeg, a shell, whatever the machine has) filling
in the capability the app deliberately lacks.

**A recipe needs something outside — that is the whole definition.** It is what the
frontmatter's `outside` records. A workflow the app covers end to end is not a recipe
but usage: the tool descriptions are its documentation, and this skill does not repeat
them. A recipe exists because the app chose not to do the thing, so each one is the
record of a feature that was not built.

## The recipes

One file each, beside this one. Read the one you need — the index is here so you never
have to read the rest.

| recipe | does | composes | outside |
|---|---|---|---|
| [take-the-silence-out](take-the-silence-out.md) | Drops the quiet stretches, non-destructively | `export_clip`, `describe_clip`, `cut` | ffmpeg |
| [polish-the-exported-file](polish-the-exported-file.md) | Loudness, size and container, one way | `export_clip` | ffmpeg |

## The seam: analyse outside, edit inside

Put **analysis** outside the app and the **edit** inside it, whenever the recipe can.
The app's edit model is what makes a result non-destructive: a cut is a `Span` in the
clip's `SpanSet`, so it is one `undo` to take back, it re-encodes nothing, and the
export lays its pieces out around it. Anything that instead re-encodes the media gives
that up, so it earns its place only when the app cannot express the edit at all.

| the recipe needs | it belongs to |
|---|---|
| to know something about the media — silence, loudness, a frame | outside: ffmpeg, or a decode in the agent |
| to change the clip | inside: `cut`, `annotate`, `set_property`, `remove_annotation` |
| a kind of change the operations cannot express | neither yet — a product decision |

## The bound

The agent reaches the app's own operations and nothing more — the tool list in
`mcp/src/tools.ts`, and `specs/006-democlip-mcp/contracts/mcp-tools.md` for the
vocabulary. So a recipe can compose only what those expose. When a scenario needs an
operation that is not there, that is a **product decision**: bring the number and the
trade, and ask (see the project-workflow skill).

## Writing a recipe down

One recipe, one file, named for what it does, with frontmatter so it can be found
without being read:

```yaml
---
name: take-the-silence-out                  # the file's name, without .md
description: Drop the quiet stretches from a clip, keeping the edit
  non-destructive — ffmpeg finds them, the app's cut takes them out.
tools: [export_clip, describe_clip, cut]    # the app's operations, as the tools name them
outside: ffmpeg                             # what it needs outside the app; never none
proved: run                                 # run once it has been run end to end, else reasoned
---
```

Then, in the body: **Goal**, **Why not a feature** (a recipe always has one), **Steps**
and **Caveats**. Name each operation as the tools name it. Say the level of proof in
the verification skill's terms, and record the number that mattered — the duration, the
ratio, the byte size. A recipe that was reasoned about but never run says so.

Add the file to the index above in the same change, or it will not be found.

## Where a recipe travels

These files are already in the format MCP reads: a directory holding a `SKILL.md` whose
frontmatter carries `name` and `description`, with the rest referenced relative to it.
MCP's **Skills over MCP** extension (`io.modelcontextprotocol/skills`, SEP-2640, Beta)
serves exactly that shape over the existing `resources` primitive, discovered through
`skills/list` and `skills/get`, so a client could load these recipes from the server
itself rather than from a checkout.

Serving them is not built yet, and two things have to be settled first. The extension
requires a skill's `name` to match its directory, so a served copy would be
`name: recipes` — the repo's skills use Title Case and would each need the same
treatment. And a skill is read only by an agent that has it installed, so today these
reach agents working in the repo; reaching the agent driving the app through MCP is
the follow-up this section names.
