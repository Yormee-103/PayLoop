# Contributing to PayLoop

Thanks for your interest in improving PayLoop. This short guide covers how to
report problems, propose changes, and get PRs merged.

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

For web changes (`web/`):

```bash
cd web
npm install
npm run lint
npm run build
```

CI (`.github/workflows/`) runs the same checks on every PR; both must be green
for review.

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

## Test policy

- `contracts/invoice/src/test.rs` must pass in full (18 tests; `MockAuth`-based
  authorization tests sit next to `mock_all_auths` convenience tests — new
  state-changing entrypoints should get both).
- Do not weaken or delete existing tests to make a change pass. If a test is
  genuinely obsolete, explain why in the PR and update it purposefully.

## Where to start

Good first issues are labeled `good first issue`. Another low-risk entry point
is improving docs or tests for the contract
(`contracts/invoice/README.md` documents the lifecycle, auth matrix and error
codes).

For offline and fast local development against a standalone Soroban environment, see the [Local Stellar Quickstart Guide](docs/LOCAL-NETWORK.md).
