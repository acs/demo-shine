---
name: Project workflow
description: How changes are made in DemoShine — one change per pull request, branch and commit conventions, what a pull request body contains, and that CI owns the version. Use when starting work, committing or opening a pull request.
---

# Project workflow

## One change per pull request

A plan's step gets its own branch and its own pull request. Stack pull requests only
when a change genuinely depends on one still open — and if you stack, know that
GitHub retargets a pull request at `main` only when its **base branch is deleted**,
which this repository does automatically on merge (`delete_branch_on_merge`). Three
stacked, merged without checking, put two branches' work in the wrong place and left
`main` without it.

## Branches and commits

- `feat/`, `fix/`, `refactor/`, `chore/`, `docs/` plus a few words:
  `refactor/domain-events`, `fix/seek-as-stall`.
- `main` is written to through pull requests, and by the version bump. Nothing is
  committed to it directly.
- **Commit messages are prose**: what changed and *why*, in the past tense, with the
  reasoning a reader needs in six months, and the honest caveats. Not a file-by-file
  changelog. Read `git log` and match it.

## The pull request body

1. **What and why** — the problem, in the words of whoever reported it, if anyone did.
2. **How it was verified** — the harness output pasted in, the unit tests, and the
   number that mattered (10.8× real time; a duration of 5.36 s).
3. **What was deliberately not done**, and why.
4. **Caveats** — what could not be verified, what is a guess, what is a trade.
5. A file table when the change is wider than a couple of files.

The user merges. The agent opens the pull request, reports, and waits.

## CI owns the version

Every merge to `main` bumps the patch, tags `vX.Y.Z` and deploys — the workflow
commits that back. Do not bump `package.json` by hand except for a deliberate minor
or major release, done before merging. See `VERSIONING.md`.

## Before pushing

```
npm run lint && npm run typecheck && npx vitest run && npm run build
```

The pre-commit hook runs `eslint --fix` on staged files. Temporary `verify-*.html`
harnesses are deleted before the commit — they are never part of a change.

## Ask when the answer is a product decision

Persistence, an interface change, what a feature should do when it cannot work —
those are the user's calls. Bring the number and the trade to them, and ask.
