---
name: Domain model
description: How to work in DemoShine's domain — value objects, the Clip aggregate, ports, where a new rule belongs, and the rule that the view listens. Use when adding or changing a rule, a class or a module under src/.
---

# The domain model

## The shape

```
src/
  domain/      pure rules: no DOM, no browser API, no import from ui/ or infra/
    clip/      Span, SpanSet, TimelineMap, Trim, Take, TakeRepository (a port), Clip (the aggregate)
  infra/       the browser boundary: codecs, download, takes (the object URLs), the export adapter
  ui/          the DOM and the interaction: renders the model, owns no rules
  recorder.ts, exporter.ts   the flows that sequence browser work
  state.ts     the shared mutable state, shrinking as each thing finds its owner
```

## Where a rule belongs

Ask who owns the thing the rule is about:

- about a **range** — order it, merge it, clamp it, intersect it → the value object (`Span`)
- about a **set of ranges** — that they never overlap, how long they cover → `SpanSet`
- about **the clip as a whole** — its length, what approving a trim means, what an
  export is made of, what a new take does to the removed regions → the aggregate
- about **a take** — it has identity, and a length it cannot be built without → `Take`
- about **the browser** — object URLs, encoders, seeking → an adapter in `infra/` or
  a flow, never the domain

An invariant belongs in the type that can enforce it: "a `SpanSet` cannot overlap"
and "a `Take` cannot have length 0" are worth more than a rule someone is asked to
remember. Prefer *cannot be represented* to *must remember to check*.

## Collaborators are ports

The aggregate needs takes and must not know how they are held, so
`domain/clip/TakeRepository.ts` is an **interface** and `InMemoryTakeRepository` in
`infra/` implements it. That is what lets `Clip.test.ts` run in node against a fake,
and it is the seam persistence would go through.

## The view listens

`app.clip.onChange(...)` announces what changed — a take added, a region approved or
put back, the handles moved, the session dropped — and the modules that draw the clip
react to what concerns them. Do not:

- call another view module's re-render from a flow or from a model change
- re-render "because I was the caller"
- put the reaction in the caller *around* the call: it runs while the model is still
  announcing, and it renders a half-updated state. That bug has happened once.

What does stay with a flow is the sequencing that depends on the **browser** — such
as building the thumbnails, which needs the element to be holding the take first.
Events say what changed about the clip, not when the browser is ready.

## Tests come with the rule

Every rule above gets a unit test beside it, in node, with a fake behind any port.
`Clip.test.ts` is the pattern for an aggregate, `SpanSet.test.ts` for a value object.

## The words

Use the words in `GLOSSARY.md` — in the code, the tests, the commits and the pull
request — and add a new concept there first. `part` was a second name for `take` for
a while, and undoing it touched nine modules.
