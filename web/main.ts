// The page's entry.
//
// The app itself lives in `src/`, one level up: the Vite root is `web/`, so that the
// repository root holds the project's config and docs and no application files. A
// module outside the root cannot be named by the page directly — the dev server would
// answer the request with the page itself — so this is the one path from the shell to
// the app, and the app's own imports are unchanged.
import '../src/main.js';
