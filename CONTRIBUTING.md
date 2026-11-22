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

- `contracts/invoice/src/test.rs` must pass in full (23 tests; `MockAuth`-based
  authorization tests sit next to `mock_all_auths` convenience tests — new
  state-changing entrypoints should get both).
- Do not weaken or delete existing tests to make a change pass. If a test is
  genuinely obsolete, explain why in the PR and update it purposefully.

## Claiming an issue

1. **Check for existing claims**: Look at the issue comments and linked PRs to see if someone else is actively working on it.
2. **Comment to claim**: Leave a comment stating you would like to work on the issue. Maintainers will confirm or assign it to avoid duplicate efforts.
3. **Issues requiring discussion**: If an issue has the `needs-discussion` label, do not start coding immediately. Share your proposed design or questions in the comments first and wait for consensus with maintainers.
4. **Work on one issue at a time**: To maintain velocity and clean review pipelines, contributors should only work on one open issue at a time.

## Labels and difficulty

Every issue in the repository is tagged with standard labels to indicate status, difficulty, and technical domain.

### Difficulty levels

| Label | Description | Expected scope & experience |
| :--- | :--- | :--- |
| `difficulty: beginner` | Suitable for first-time contributors | Self-contained changes, docs, copy adjustments, or localized UI/bug fixes. Minimal codebase familiarity required. |
| `difficulty: intermediate` | Some familiarity with the codebase needed | Multi-component web features, Soroban contract integrations, state refactoring, or accessibility enhancements. |
| `difficulty: advanced` | Large or design-heavy task | Significant architecture, new contract primitives, security-critical changes, or cross-cutting abstractions. |

### Contributor workflow labels

| Label | Purpose |
| :--- | :--- |
| `good first issue` | Curated newcomer-friendly tasks with clear boundaries and minimal dependencies. Excellent place to start. |
| `help wanted` | Open issues where maintainers are actively looking for external contributions. |
| `needs-discussion` | Requires agreement on technical approach, UX design, or data migration before implementation begins. |

### Domain & area labels

| Label | Area | Description |
| :--- | :--- | :--- |
| `contract` | Smart contracts | Soroban smart contracts in `contracts/invoice/` (Rust). |
| `web` | Frontend app | Next.js 15 (App Router), TypeScript, and Tailwind CSS in `web/`. |
| `dx` | Developer experience | Tooling, devcontainer, scripts, GitHub Actions workflows, or linters. |
| `ux` | User experience | User flows, form ergonomics, error feedback, and loading states. |
| `a11y` | Accessibility | WCAG compliance, screen reader support, keyboard navigation, and contrast. |
| `design` | Visual styling | Component styling, color palettes, spacing, and theme consistency. |
| `performance` | Performance | Bundle size, network calls, caching, rendering speed, and optimizations. |
| `security` | Security | Hardening, authorization rules, sanitization, CSP headers, and audits. |
| `testing` | Quality assurance | Unit tests, mock tests, regression suites, and CI coverage. |
| `integration` | Ecosystem integration | Third-party protocols, Horizon/Soroban RPCs, SEP-24 anchors, or wallets. |
| `refactor` | Code health | Code cleanup and modularization with zero behavioral changes. |
| `documentation` | Documentation | Guides, architectural notes, README files, or API references. |

### Triage & tracking labels

| Label | Purpose |
| :--- | :--- |
| `bug` | Confirmed defects where behavior contradicts intended functionality. |
| `enhancement` | New user capabilities, features, or design improvements. |
| `question` | Inquiries regarding usage, local setup, or architecture. |
| `duplicate` | Points to another issue or PR covering the same problem. |
| `invalid` | Out-of-scope, unreproducible, or incorrect assumptions. |
| `wontfix` | Decided against implementing or out of project roadmap. |
| `Stellar Wave` | Issues participating in the Stellar Wave developer program. |

## Where to start

Good first issues are labeled `good first issue`. Another low-risk entry point
is improving docs or tests for the contract
(`contracts/invoice/README.md` documents the lifecycle, auth matrix and error
codes). For running and developing offline, see the [Local Stellar Quickstart Guide](docs/LOCAL-NETWORK.md).
