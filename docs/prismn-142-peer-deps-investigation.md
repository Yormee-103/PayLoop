# Peer dependency investigation (prismn-142)

Standalone investigation plan for removing `legacy-peer-deps=true` from `web/.npmrc`. This document does not change `web/.npmrc`, `web/package.json`, or the lockfile.

## Current state

`web/.npmrc` contains a single line:

```ini
legacy-peer-deps=true
```

That setting suppresses npm's peer dependency validation. It may hide incompatibilities between the pinned web dependencies:

- React `19.0.0` and React DOM `19.0.0`
- Next.js `15.5.20`
- `@sentry/nextjs` `8.47.0`
- `@stellar/freighter-api` `3.0.0`
- `@stellar/stellar-sdk` `16.0.1`
- `@vercel/analytics` `1.4.1`

## Reproduction procedure

1. Work from a clean checkout at the current `main` SHA.
2. Temporarily remove `legacy-peer-deps=true` from `web/.npmrc`.
3. Delete any local `node_modules` and existing npm cache state for this project only.
4. Run `npm install` from `web/` with Node `22.x`.
5. Capture the full peer dependency tree and the exact conflicting ranges.
6. Run `npm ci`, `npm run lint`, and `npm run build`.
7. Restore `web/.npmrc` until a decision is recorded.

## Decision matrix

| Outcome | Action |
| --- | --- |
| Install, lint, and build pass with no warnings | Remove the flag and commit the resulting lockfile changes. |
| Only warnings appear, all checks pass | Remove the flag and document each remaining peer warning in the PR. |
| Install fails because a package has not caught up to React 19 or Next 15 | Try a compatible patch/minor version or `overrides`; document why each override is needed. |
| Conflicts are unavoidable | Keep the flag and record every blocking conflict with package versions and upstream issue links. |

## Suggested PR description template

```text
Removed/kept legacy-peer-deps because <decision>.

Observed conflicts:
- <package> requires <range>, resolved <version>
- ...

Checks:
- npm ci: <pass/fail>
- npm run lint: <pass/fail>
- npm run build: <pass/fail>
```

## Safety notes

- Do not regenerate the lockfile unless dependency versions actually change.
- Avoid broad version bumps; keep this investigation single-purpose.
- If a package is abandoned or incompatible, prefer a documented exception over hiding all peer errors globally.
