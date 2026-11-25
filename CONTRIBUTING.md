# Contributing to PayLoop

Thanks for your interest in improving PayLoop. This short guide covers how to
report problems, propose changes, and get PRs merged.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) — by participating in
this project you agree to abide by its terms.

## Reporting bugs

Open a GitHub issue. A good bug report includes:

1. **What you did** — which page/route and what you clicked or signed.
2. **What happened vs. what you expected** — include the exact error text.
3. **Environment** — browser + Freighter version, network (testnet/mainnet),
   and whether you're on the live app or a local build.
4. **On-chain evidence** if relevant — a
   [stellar.expert](https://stellar.expert) transaction or contract link
   (contract addresses are in the root README).

Feature requests are also welcome as issues — include the user problem you're
trying to solve rather than a specific implementation.

## Submitting a pull request

1. Fork, then create a branch off `main` (e.g. `fix/faucet-rate-limit`).
2. Keep PRs small and single-purpose. One logical change per PR.
3. Follow the existing code style:
   - Rust: `cargo fmt` formatting, no new clippy warnings,
     conventional commits (`fix:`, `feat:`, `docs:`, `chore:`, `test:`).
   - TypeScript: the repo ESLint config (`npm run lint` in `web/`).
4. Add or update tests for anything behavioral.
5. Link the issue being fixed (`Fixes #123`).

## Required checks before opening a PR

For contract changes (`contracts/invoice/`):

```bash
cd contracts
cargo fmt --all --check
cargo clippy --all-targets
cargo test
cargo build --target wasm32v1-none --release   # optional; CI builds it
```

### Test snapshots

`cargo test` writes JSON snapshots to `contracts/invoice/test_snapshots/`.
They are build output, so they are **not committed**: the directory is listed
in `.gitignore` and the contract CI fails if any file under a `test_snapshots/`
folder is tracked. If git shows them as changes, you have an old checkout;
run `git rm -r --cached contracts/invoice/test_snapshots` and do not add them
back. Assertions belong in the tests themselves, not in snapshot diffs.

For web changes (`web/`):

```bash
cd web
npm install
npm run lint
npm run build
```

### Formatting

The `web/` project is formatted with [Prettier](https://prettier.io) (config in
`web/.prettierrc`, editor defaults in the root `.editorconfig`). Before opening
a PR that touches `web/`, run:

```bash
cd web
npm run format        # reformat changed files in place
npm run format:check  # verify formatting without changing files
```

CI runs `format:check` on every PR. Formatting the existing `web/` tree is a
separate one-time step, so do not reformat unrelated files in your PR.

CI (`.github/workflows/`) runs the same checks on every PR; both must be green
for review.

## Git hooks (optional, recommended)

[lefthook](https://lefthook.dev) runs Prettier and ESLint on staged `web/`
files and `cargo fmt --check` on staged `contracts/` Rust files, so
formatting and lint failures are caught locally before CI. Hooks only run on
relevant staged files and are configured in `lefthook.yml`.

Install once after cloning (from the repo root):

```bash
cd web && npm install
./web/node_modules/.bin/lefthook install
```

To skip hooks for a single commit, use `git commit --no-verify` or prefix the
command with `LEFTHOOK=0`.

## Review process

- Maintainers review PRs by impact area: contract changes get a deliberate
  security/authorization read (`require_auth` placement, error paths, storage
  growth) before approval; web changes get a UX-and-truthfulness read
  (displayed data must match what the contract actually recorded).
- Contract changes that alter stored-data layouts or entrypoint semantics are
  discussed in an issue before implementation, because the deployed testnet
  instance is relied on by the activity page and prior invoice records.
- Honest scope beats impressive scope: PRs should state clearly what is
  implemented versus mocked or documentation-only (see `docs/ARCHITECTURE.md`
  and `docs/ANCHOR.md` for the current split).

## Labels and difficulty

Issues carry a few kinds of label. A label's description in the GitHub label
list is the short version of what is below.

**Where you can start**

- `good first issue`: small, well-scoped, no discussion needed. Start here if
  you are new to the repo.
- `help wanted`: maintainers would like outside help on it.
- `needs-discussion`: agree on the approach in the issue **before** writing
  code (for example anything that needs a contract redeploy or changes stored
  data). Do not open a PR for these until a maintainer has replied.

**Difficulty**

- `difficulty: beginner`: suitable for first-time contributors.
- `difficulty: intermediate`: needs some familiarity with the codebase.
- `difficulty: advanced`: large or design-heavy; talk to a maintainer first.

**Area**

- `contract` (Soroban contract) and `web` (Next.js app) say which part of the
  repo the issue touches.
- `a11y`, `security`, `testing`, `dx` (developer experience), `ux`, `design`,
  `performance`, `integration` (third-party or ecosystem) and `refactor` (no
  behaviour change) say what kind of change it is.

**Type and status**

- `bug`, `enhancement` and `documentation` say what kind of work it is.
- `question` is for questions, not tasks.
- `duplicate`, `invalid` and `wontfix` mean the issue is closed without work.
- `Stellar Wave` marks issues that belong to the Stellar wave program.

### Claiming an issue

1. Comment on the issue that you would like to take it. Wait for a maintainer
   to assign it to you before starting; for `needs-discussion` issues also wait
   for the approach to be agreed.
2. Work on one issue at a time, and keep the PR to what the issue asks for.
3. Link it in your PR with `Fixes #123`.
4. If you can no longer work on it, say so on the issue so someone else can
   take it.

## Test policy

- `contracts/invoice/src/test.rs` must pass in full (23 tests; `MockAuth`-based
  authorization tests sit next to `mock_all_auths` convenience tests — new
  state-changing entrypoints should get both).
- Do not weaken or delete existing tests to make a change pass. If a test is
  genuinely obsolete, explain why in the PR and update it purposefully.

## Where to start

Good first issues are labeled `good first issue`. Another low-risk entry point
is improving docs or tests for the contract
(`contracts/invoice/README.md` documents the lifecycle, auth matrix and error
codes).
