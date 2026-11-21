# Quickstart — proving the agent side works

How to check the change end-to-end, and what each check is worth. The rules are in
`data-model.md`; the seams are in `contracts/`; the sequence is in `plan.md`.

## Prerequisites

```bash
npm install
npx playwright install chromium     # the end-to-end suite's browser
```

## 1. The rules — unit tests, in node

```bash
npx vitest run src/ui/agent          # the surface's own rules
npm --prefix mcp test                # the server: the tool list, the refusals, the version check
```

**What must pass**

- the surface refuses what the app refuses, and answers a reason rather than throwing: a
  stretch below the minimum, an annotation kind it does not know, a property value the
  kind will not take, an export on a clip with nothing in it;
- `describe()` reports the clip as data — the length, the takes, the cuts, and each
  annotation's properties with the values they hold, the same list the inspector renders;
- the server's tool list is exactly the operations, with no tool that evaluates code;
- the version check refuses a page whose version does not match, with a reason;
- a publish without a sign-in is refused, and nothing is sent.

**What this does not prove**: anything about the page, the browser, the picture or the
file — those are the suite's and the real session's, below.

## 2. What a person sees — the committed end-to-end suite

The suite drives the real app in a headless Chromium, and a check reaches the surface the
way the server does:

```bash
npm run test:e2e
# or the new area alone:
npx playwright test --config e2e/playwright.config.ts e2e/checks/agent.spec.ts
```

| Scenario | Assert |
|---|---|
| The gate | a page opened **without** the flag publishes nothing; opened with `?agent=1`, `window.democlip` is there and its `version` is the app's (spec D1, FR-018) |
| Describe | after `boot` seeds a clip, `describe()` reports the takes, the length and no cuts (FR-010) |
| Cut | a `cut` through the surface leaves the chip saying what was cut and the undo button visible — what a person sees, not just the model (FR-005, FR-007) |
| Annotate | an `annotate` through the surface draws on the picture and marks the lane, exactly as the section's action does (FR-005) |
| A property | `setProperty` on a colour changes what the layer paints, and one `undo` puts it back (FR-007, FR-012) |
| A refusal | a cut below the minimum answers `{ ok: false, reason }`, and the clip is unchanged (FR-008) |
| Recording | with `installStandInShare` in place, `turn_source_on('screen')` — delivered as a real click — makes the app ask for a share, and the check reads back that the call carried the person's activation; then `start_take`/`stop_take` lands a take in the clip (FR-004, FR-005) |
| Export | `export_clip('webm')` produces the browser's download, the check reads it, and the file holds the cut and the annotation that were made (FR-006, SC-003) |
| Publish | with the service stood in for by `page.route`, a publish posts; **without** a sign-in it is refused with a reason and nothing is sent (FR-014) |

**What this does not prove**: the real share picker, and a real post to a real account.
Both are the user's session, below. The activation half of the press *is* proved here,
because that is the half a check can hold.

## 3. The server, by hand

```bash
npm run build                       # the app's build the server ships
node mcp/dist/index.js              # or: npx democlip-mcp
```

Add it to OpenCode (see `contracts/mcp-tools.md` §4), then in the chat:

1. ask for the clip (`describe_clip`) — the tools are there and the server is connected;
2. ask for a cut and an annotation, and watch the window change;
3. ask for an export, and open the file at the path it answers with.

## 4. The real session — the user's

Two things no check can do, and both must be run by a person:

- **the share picker.** Ask the agent to turn the screen source on, and choose a window,
  tab or screen in the browser's own picker. This is the one place the clarified Q1 is at
  the browser's mercy: if the press does not carry the activation the picker needs, the
  source toggle goes back to being the person's, and the spec is amended rather than the
  behaviour quietly weakened.
- **a real post.** Sign in to publish in that window, ask for a post, and look at it. The
  suite stands the service in; only a real account proves the real thing.

## 5. What cannot be checked here

- **the share picker** — `getDisplayMedia` needs a gesture and a picker; the suite proves
  everything *after* a share is handed back, and the picker is the user's (Verification
  skill).
- **a real recording** of a real screen.
- **the exported file's pixels** — the check asserts the renderers ran and the file was
  written and read back, not what a viewer sees.
- **a real publish** to a real account.
- **the person watching** — that a change is visible in *their* window is asserted by the
  suite against the same page the server drives, not against a second pair of eyes.

## Reporting

In the pull request: the unit-test output, the suite's output, the words of the
Verification skill — which level each part got — and the honest gaps above, including the
two the user ran.