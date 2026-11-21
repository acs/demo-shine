# Phase 1 — Contract: End-to-End Test Support

The suite's "interface" is the small set of helpers every check is written against,
and the CI job that runs it. A check depends on **these**, and never on the app's
internals. The contract is deliberately narrow: it is what makes FR-001 (the real
app), FR-015 (no application change) and SC-006 (a new check touches no app code)
true at once.

## 1. Fixture takes — `e2e/fixtures/takes.ts`

```ts
export interface FixtureSpec {
  width: number;          // > 0
  height: number;         // > 0
  seconds: number;        // > 0, the exact duration
  fps?: number;           // default 30
  hasAudio?: boolean;     // default false
  pattern?: string;       // default: a numbered solid colour per frame
}

export interface FixtureTake {
  index: number;          // where its blob is kept in the page, for boot.seed
  seconds: number;
  shape: string;          // "1280×720"
  hasAudio: boolean;
}

/** Build one deterministic take in the page. Resolves in milliseconds, never in real time. */
export function makeTake(page: Page, spec: FixtureSpec): Promise<FixtureTake>;

/** Build several, for a multi-take clip. */
export function makeTakes(page: Page, ...specs: FixtureSpec[]): Promise<FixtureTake[]>;

/** A page-side module at the repository root, as the dev server serves it (`/@fs/...`). */
export function pageModule(path: string): string;
```

**Contract**:

- The blob is **WebM** with a real duration and cues, produced with WebCodecs +
  Mediabunny (the app's own encoder path). It is not a `MediaRecorder` file.
- The blob **stays in the page**; the test holds only its metadata and its index, and
  `boot.seed` reads it back there.
- The same spec yields the same take from run to run.
- The blob decodes through the app's own `take-probe` and strip unchanged.
- Nothing is committed as a binary; takes are generated in the check.

## 2. The boot helper — `e2e/helpers/app.ts`

```ts
export interface Booted {
  /** Navigate to "/" and wait until the status chip reads "Ready". */
  goto(): Promise<void>;
  /** Clear the clip, the kept copy and the stored pictures. */
  clear(): Promise<void>;
  /** Clear the clip and add the given takes, through the app's own module. */
  seed(takes: FixtureTake[]): Promise<void>;
}

/** Wrap a Playwright page. Changes no application code. */
export function boot(page: Page): Booted;
```

**Contract**:

- `goto()` waits on a **person-visible** signal (the status chip's text), not a fixed
  timeout.
- `seed()` reaches the app through a dynamic import of `e2e/support/app-hooks.ts` in
  page context — the same module instance the views use — so no test hook is added to
  the app. The file is served at `/@fs/<repo-root>/e2e/support/app-hooks.ts` (the Vite
  root is `web/`); `pageModule()` (`e2e/helpers/page-module.ts`) builds that URL from
  the file's own location, so nothing is machine-specific.
- `clear()` empties the clip and the IndexedDB stores, so no check inherits state
  (FR-013).
- The helper never asserts; it only sets up.

## 3. Stand-ins — `e2e/helpers/stand-ins.ts`

```ts
/** Install before goto(): take the place of getDisplayMedia with a canvas stream. */
export function installStandInShare(page: Page, opts?: { silent?: boolean }): Promise<void>;

/** What the app asked getDisplayMedia for, so a check can assert it. */
export function askedFor(page: Page): Promise<DisplayMediaStreamOptions>;
```

**Contract**:

- `installStandInShare` is called **before** the app loads (`page.addInitScript`).
- It records the constraints the app passed, so the cursor, frame rate and pane can be
  asserted — the regression that stopped asking for them.
- `silent: true` resolves a stream with **no** audio track, for the silent-share check.
- The picker is never opened; this stands in only for what comes back from it
  (FR-010).

## 4. How a check is written

- **Location and name**: `e2e/checks/<area>.spec.ts`. Vitest's `include` is
  `src/**/*.test.ts`, so these are never run by `npm test`.
- **Shape**: `goto()` → `clear()`/`seed(...)` → the real interaction → assert what a
  person would see (FR-016). The model is reached only where the view shows nothing.
- **No fixed waits**: assert on a visible state, or wait on an event; a `setTimeout`
  fallback is the thing this feature retires.
- **No network**: the publishing service is stood in for.
- **Skip, don't pass**: a check that cannot run (a missing codec, for example) calls
  `test.skip(true, '<reason>')` with a stated reason (FR-014).
- **A regression check** carries, in its own file or a comment, the `beforeCommit` it
  was proved to fail against (FR-005).

## 5. The CI job

In `.github/workflows/ci.yml`, beside `quality`:

```yaml
e2e:
  runs-on: ubuntu-latest
  env: { HUSKY: 0 }
  steps:
    - uses: actions/checkout@v7
    - uses: actions/setup-node@v7
      with: { node-version: 22, cache: npm }
    - run: npm ci
    - run: npx playwright install --with-deps chromium
    - run: npm run test:e2e
    - uses: actions/upload-artifact@v6
      if: always()
      with:
        name: playwright-artifacts
        path: |
          playwright-report/
          test-results/
        retention-days: 7
        if-no-files-found: ignore
```

**Contract**:

- Runs on every pull request; the maintainer marks it a **required status check** so a
  failure blocks the merge (FR-002).
- Chromium only (R10).
- The whole job stays **under 5 minutes** (SC-004).
- The report and the evidence are kept as **artifacts on every run** — GitHub's
  `actions/upload-artifact` is GitLab's `artifacts:` — with a `retention-days` cap;
  the evidence inside is failure-only, because the config keeps it that way (FR-017).
- `package.json` gains `"test:e2e": "playwright test --config e2e/playwright.config.ts"`; `version` is not touched.

## 6. The runner config — `e2e/playwright.config.ts`

- `testDir: 'e2e/checks'`, one `chromium` project.
- `webServer`: `npm run dev -- --port 5174 --strictPort`,
  `url: 'http://127.0.0.1:5174'`, `reuseExistingServer: false` — the suite always starts
  its own server, so it never attaches to a foreign one on the default 5173 (R12).
- `workers: process.env.CI ? 2 : 4` — bounded so parallel checks do not starve each
  other's fixture encoders (R12).
- Launch args: `--use-fake-device-for-media-stream`,
  `--use-fake-ui-for-media-stream`, `--autoplay-policy=no-user-gesture-required`.
- `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`,
  `video: 'retain-on-failure'`.
- Checks must not share state, so `seed()` clears the clip before it adds takes.
