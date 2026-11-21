# Phase 0 — Research: Automated End-to-End Tests

Every open question in the Technical Context is resolved here. Nothing is left as
`NEEDS CLARIFICATION`.

## R1. The runner

- **Decision**: **Playwright Test** (`@playwright/test`, development-only).
- **Rationale**: It navigates the app's real page (`web/index.html`) on the dev server, starts
  and stops that server for us (`webServer`), drives a headless Chromium, lets a
  check stand in for the network (`page.route`) and for the share API
  (`addInitScript`), passes the fake-device flags Chromium needs, and leaves a trace,
  a screenshot and a video on failure — the evidence artifact FR-017 asks for. Its
  browsers are already cached on the developer machine, so a local run downloads
  nothing.
- **Alternatives considered**:
  - **Vitest browser mode** (`@vitest/browser-playwright`) — one runner and one
    config, but thinner navigation, network and failure-trace tooling, and it would
    blur the unit/browser split the project wants to keep clean.
  - **Cypress** — heavier, a different assertion model, and no benefit here.
  - **Puppeteer** — a driver, not a runner; no `webServer`, no fixtures, no report.
  - **A hand-rolled node script** — reinvents the runner; the harnesses already
    showed why a throwaway script leaves nothing behind.

## R2. Where a take comes from

- **Decision**: **Generated deterministically inside the check** with WebCodecs +
  Mediabunny, reusing the app's own offline-encoder path (an `Output` +
  `CanvasSource` + `BufferTarget`).
- **Rationale**: A `Take` is only a `Blob` and a `duration`. The domain already
  tests with `FakeTakes` and `new Blob(['x'])`; the browser layer needs real,
  decodable video only where the DOM must decode, seek, thumbnail or encode. The
  encoder path already writes a WebM **with a duration and cues**, offline and ~10×
  faster than real time, so a fixture is exact, repeatable and milliseconds long.
- **Alternatives considered**:
  - **`MediaRecorder` from a canvas** (what the throwaway harness does) — real but
    **real-time** (a 2 s clip costs 2 s), its WebM reports `duration = 0 / Infinity`
    (why `take-probe.ts` has a 1.5 s guess), and its frames and timestamps wander.
    This is the flakiness the spec's US3 wants gone.
  - **Checked-in binary fixtures** — deterministic bytes, but a binary in the repo,
    codec drift, and hard to vary by size, length and sound.
- **Constraint carried forward**: fixture takes are **WebM**, because
  `offline-encoder` reads takes with `formats: [WEBM]`; even the MP4 export check is
  fed a WebM take.

## R3. Where the suite runs

- **Decision**: The **Vite dev server** (`npm run dev`), started by Playwright's
  `webServer` on a dedicated port **5174** with `reuseExistingServer: false` (see
  R12). The Vite root is `web/` (see R11).
- **Rationale**: In dev the app **unregisters its service worker**, so a reload check
  reads fresh code and not a cache — the edge case the spec calls out. Startup is
  fast, and it is the same server the throwaway harnesses ran on.
- **Alternatives considered**: `vite preview` on a built bundle — closer to
  production, but its cache-first service worker complicates the reload check, and
  the build adds time to every run.

## R4. How a check seeds the app, without changing it

- **Decision**: Navigate to `/`, wait for the status chip to read Ready, then seed
  state in **page context** through a dynamic import of `e2e/support/app-hooks.ts`,
  reached at `/@fs/<repo-root>/e2e/support/app-hooks.ts` (see R11).
- **Rationale**: The hooks file re-exports the app's own modules, and its relative
  imports resolve to the URLs the app loaded, so it is the **same module instance**
  the views are wired to. The application gains no test hook and no runtime code
  (FR-015).
- **Alternatives considered**:
  - A `window.__democlip` test hook — changes the app for the test's sake; rejected.
  - Driving the UI only — impossible for editing without recording, which the spec
    forbids for editing checks.

## R5. The flows the browser will not let a machine drive

- **Decision**: **Stand in** for the parts that need a user gesture or an external
  service:
  - **The share API**: `addInitScript` replaces
    `navigator.mediaDevices.getDisplayMedia` with one that resolves a
    `canvas.captureStream()`. The picker cannot be opened, but everything the app
    does **after** a stream is handed back can be driven — which is where the four
    regressions lived.
  - **The devices**: Chromium's `--use-fake-device-for-media-stream` and
    `--use-fake-ui-for-media-stream` give the webcam and mic a fake source.
  - **The network**: `page.route` stands in for the publishing service.
- **Rationale**: FR-010 and FR-011 keep the picker, real audio, real device variety
  and a live sign-in round-trip as a person's checks; this covers the boundary just
  inside them.
- **Alternative considered**: skip the capture path entirely — rejected, because that
  is exactly the layer with no guard today.

## R6. Naming, so the two runners never collide

- **Decision**: `e2e/**/*.spec.ts`, and `playwright.config.ts` at the repository root.
- **Rationale**: Vitest's `include` is `src/**/*.test.ts`, so `e2e/**/*.spec.ts` is
  never picked up by `npm test` (FR-012). Two extensions — `.test.ts` for node,
  `.spec.ts` for the browser — read as what they are.

## R7. The check's time budget

- **Decision**: The whole `e2e` job on a pull request stays **under 5 minutes**, the
  browser install included (SC-004).
- **Rationale**: That is the usual ceiling for a browser suite people keep as a
  required check. It leaves room for the four regression checks, the editing and
  export checks, the install step, and headroom for the suite to grow.

## R8. Determinism

- **Decision**: No dependence on real elapsed time beyond what a browser forces; no
  network; IndexedDB cleared between checks; fixture takes exact.
- **Rationale**: FR-013 and SC-003. A flake is a bug fixed at its source, never
  waited out (the project's own verification rule). The old harnesses' `setTimeout`
  fallbacks — the 1.5 s duration guess, the 3 s seek race — are the thing being
  retired.

## R9. CI shape

- **Decision**: A second job, `e2e`, beside `quality` in
  `.github/workflows/ci.yml`: `npm ci`, `npx playwright install --with-deps
  chromium`, `npm run test:e2e`, and `actions/upload-artifact` (the GitHub
  equivalent of GitLab's `artifacts:`) of `playwright-report/` and `test-results/`
  **on every run**, with `retention-days: 7`. The evidence inside is failure-only,
  because the config keeps it that way. Chromium only.
- **Rationale**: FR-002 (block the merge) and FR-017 (evidence). Making the job a
  **required status check** is a repository setting the maintainer applies; the
  workflow only provides the job.
- **Alternative considered**: one job doing both suites — rejected, so a unit-test
  failure is not hidden behind a browser install, and the two can be reasoned about
  separately.

## R10. The engine

- **Decision**: **Chromium only** at first.
- **Rationale**: The app targets modern browsers, and one engine keeps CI honest and
  quick. WebKit and Firefox are a later, optional project; a Safari-only capture
  quirk stays outside the net until then, and that is said out loud.

## R11. Reaching the app now that the Vite root is `web/`

- **Decision**: A page-side module at the repository root is imported at
  `/@fs/<repo-root>/<path>`, built by `pageModule()` (`e2e/helpers/page-module.ts`)
  from that file's own location.
- **Rationale**: The web-shell refactor moved the page, the stylesheet and `public/`
  into `web/` and set the Vite root there. A page cannot name a file at the repository
  root by its path — the dev server answers with the page — and the dev server serves
  files outside the root (allowed by `server.fs.allow: ['..']`) at `/@fs/<abs>`. The
  suite's browser-side modules (`encode-take.ts`, `app-hooks.ts`) live at the root, so
  they are reached this way; `app-hooks.ts`'s own relative imports then resolve to the
  app's module URLs, so the two share one instance each.
- **Alternative considered**: move the suite's browser modules into `web/` so their
  URLs are stable — rejected, because it puts test support inside the app shell.

## R12. A dedicated port, and never a server the suite did not start

- **Decision**: The suite starts its own dev server on **5174** with `strictPort`, and
  `reuseExistingServer: false`; workers are bounded to 4 (2 in CI).
- **Rationale**: The first full runs failed with the page stuck on *Initialising* and
  the suite's modules 404ing, because `reuseExistingServer` attached to a Vite server
  on the default port 5173 from **another worktree** — the suite was testing the wrong
  app. Starting its own server makes a run independent of what is already listening
  (FR-013). Sixteen parallel workers also starved each other's encoders; four keep the
  run inside its budget without starving them.
