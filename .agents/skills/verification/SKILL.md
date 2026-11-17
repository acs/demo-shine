---
name: Verification
description: How to prove a change works in DemoShine — unit tests in node, a browser harness on the running dev server, and what must be said about what was not verified. Use before claiming any change works, and when reviewing one.
---

# Verification

A passing build proves the types line up and nothing more. Do not describe a change
as working because `npm run lint`, `npm run typecheck` and `npm run build` passed.

## Three levels, and which one a change needs

| the change touches | it is proved by |
|---|---|
| a rule in `src/domain/` | a **unit test**, in node, next to the file |
| anything drawn, played, encoded or wired to the DOM | a **browser harness** on the running dev server |
| the recorder's flow (screen share, a take arriving) | a **real session**, by the user — no harness can start a share |

Say which level a change got, in the pull request, in those words.

The recorder's row is not a gap to be closed later: `getDisplayMedia` needs a user
gesture and a browser picker, so **no harness here can start a share**. Keep changes
to that flow small, and ask the user to run it.

## Unit tests

- Every rule in `domain/` has one. A rule without a test is a rule that will drift.
- **A refactor's proof is the old tests passing unmodified.** If they had to change,
  the behaviour changed — decide that deliberately and say so.
- Collaborators sit behind ports so they can be faked: `Clip.test.ts` runs against
  `FakeTakes` with no browser at all.
- `npx vitest run`, or one file while iterating: `npx vitest run src/domain/clip/Clip.test.ts`

## The browser harness

1. Write `verify-<what>.html` in the repository root: a copy of `index.html` with a
   module script injected before `</body>`.
2. Build the state by hand rather than recording it:
   `app.clip.clear(); app.clip.addTake(blob, 4);`, and set `app.marks`, `app.phase`.
3. Report through a `<pre id="verify">` and read that element back — the panel is
   the only view of the page there is.
4. Open it on the running dev server and read the element back.
5. **Delete the file before committing.** These are never part of a change; the
   evidence is the output pasted into the pull request.

## What the sandbox cannot do, and the stubs that get around it

- A WebM recorded here has `duration = 0` and cannot be seeked. Model the element:
  define `currentTime`, `paused`, `duration`, `ended`, `seeking`, `play()`, `pause()`
  on `el.rv`, and dispatch `seeked` and `loadeddata` when they are asked for.
- The panel is **backgrounded**, so animation frames may never run: re-route them
  before importing anything —
  `window.requestAnimationFrame = fn => setTimeout(() => fn(performance.now()), 16)`.
- Effects leave traces worth asserting on: `CanvasRenderingContext2D.prototype.drawImage`
  and `globalAlpha` for compositing, `AudioParam.prototype.linearRampToValueAtTime`
  for the fades, `URL.revokeObjectURL` for what the repository releases,
  `HTMLAnchorElement.prototype.click` for the download.

## Assert what a person would see, not only the model

The chip's text, whether the undo button is visible, what the status line says. A
bug in the *view* is invisible to a model assertion, and one was found exactly this
way: the marks rendered while the model was still announcing, so the chip showed a
section of zero length and the undo button never appeared.

## When a harness fails, check the expectation first

It has been the test's own arithmetic far more often than the code. Work the number
out before changing anything: a 6 s clip with 3.6 s removed has **2.4 s** left, and
20 s of clip with 1 s removed keeps **19 s**.

## Say what was not verified

Every pull request says what it could not check and why — the recorder's flow, a
real recording, an ear on the exported audio, headless numbers being headless
numbers. An honest gap is worth more than a clean story.
