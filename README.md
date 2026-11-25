# PayLoop

[![Contract CI](https://github.com/Yormee-103/PayLoop/actions/workflows/contract.yml/badge.svg)](https://github.com/Yormee-103/PayLoop/actions/workflows/contract.yml)
[![Web CI](https://github.com/Yormee-103/PayLoop/actions/workflows/web.yml/badge.svg)](https://github.com/Yormee-103/PayLoop/actions/workflows/web.yml)
[![Deploy (CD)](https://github.com/Yormee-103/PayLoop/actions/workflows/deploy.yml/badge.svg)](https://github.com/Yormee-103/PayLoop/actions/workflows/deploy.yml)

**Get paid for freelance work in seconds, not weeks — with a permanent, portable income record.**

PayLoop is an invoicing + escrow dApp built on [Stellar](https://stellar.org)/Soroban. It lets freelancers (built with Nigerian & African freelancers working with foreign clients in mind) create an invoice, share a payment link, and receive **USDC** the moment a client funds it — settling in ~5 seconds for a fraction of a cent, instead of the 2–5 days and 5–8% that PayPal/Payoneer cost. Every paid invoice is a timestamped on-chain record that becomes the freelancer's portable income history.

---

## The core loop

```
create_invoice  →  fund_invoice (client pays, escrow + instant release)  →  Paid, on-chain forever
```

That create → fund → release loop is PayLoop. Everything else is UX around it.

**🔗 Live app:** https://pay-loop-neon.vercel.app &nbsp;·&nbsp; **🎬 Demo video:** https://www.loom.com/share/0b08c1208df841ac96ecd61b2b05a7a9 &nbsp;·&nbsp; **🎤 Pitch deck:** [/pitch](https://pay-loop-neon.vercel.app/pitch) (web) · [PayLoop-Pitch-Deck.pptx](docs/pitch/PayLoop-Pitch-Deck.pptx)

---

## Quick start

### Prerequisites
- Node.js 20+
- Rust & `stellar` CLI (`cargo install --locked stellar-cli`)
- [Freighter Wallet](https://www.freighter.app/) extension

### Run locally

```bash
# 1. Clone the repository
git clone https://github.com/Yormee-103/PayLoop.git
cd PayLoop

# 2. Smart contract (optional for web-only dev)
cd contracts/invoice
cargo test                    # run unit tests
stellar contract build        # build the wasm
cd ../..

# 3. Web frontend
cd web
cp .env.example .env.local     # public testnet defaults are pre-configured
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

See [contracts/DEPLOYMENT.md](contracts/DEPLOYMENT.md) for the full testnet deploy and token setup steps.

---

## Features

- Create an invoice on-chain (client, token, amount, description, optional due date).
- **Preview the invoice** before it goes on-chain, and **export any invoice as PDF**.
- Share a `/pay/<id>` link; the client funds it in one wallet click.
- Instant settlement — the invoice's own token moves client→freelancer atomically,
  marked `Paid`.
- **Invoice history** page with search + status/role filtering and **payment
  reminders** (one-click copy-to-send).
- Freelancer dashboard: invoices, balance, received/pending totals, test-USDC faucet,
  and an **overdue/pending reminders** card.
- Public on-chain activity feed with unique-wallet and settled-volume stats +
  **CSV export**.
- **Dark/light mode** toggle (dark default) and a **first-run onboarding tour**.
- Mocked USDC→Naira off-ramp with a documented SEP-24 path.
- Monitoring (Sentry) + analytics (Vercel) + in-app feedback collection.
- **Pitch deck** live at [/pitch](https://pay-loop-neon.vercel.app/pitch).

---

## Why Stellar

| Problem (today) | PayPal / wire | PayLoop on Stellar |
| --- | --- | --- |
| **Speed** | 2–5 days; PayPal 21-day holds | ~5 second settlement |
| **Cost** | 3–5% fee + 5–8% FX markup | fractions of a cent network fee |
| **Income trail** | scattered bank alerts, WhatsApp | tamper-proof on-chain invoice history |
| **Compliance** | you become a money transmitter | anchors handle the regulated fiat on/off-ramp |

---

## Architecture

- **Smart contract** — `contracts/invoice`, Rust/Soroban, deployed to Stellar **testnet**. Holds invoices and performs the atomic client→freelancer USDC transfer on funding.
- **Web app** — `web/`, Next.js (App Router) + TypeScript + Tailwind, Freighter wallet, deployed on Vercel. Mobile-responsive, with loading/error states throughout.
- **Observability** — Sentry (errors) + Vercel Analytics (usage).
- **Public activity feed** — `/activity` reads every invoice straight off the contract and reports usage stats; doubles as verifiable proof of wallet interactions.
- **Feedback** — in-app widget → `/api/feedback` (forwards to an optional webhook).
- **Anchor off-ramp** — USDC → Naira bank payout is **mocked** for this submission with clear UX and a documented integration path. See [docs/ANCHOR.md](docs/ANCHOR.md).

Full design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Contract-level integrator reference (entrypoints, auth matrix, errors, events, integration code): [contracts/invoice/README.md](contracts/invoice/README.md).

### Soroban architecture at a glance

- **The contract is the only database.** Invoice state lives in two persistent
  storage keys per freelancer (`Invoice(id)` records and a per-freelancer
  `History` index) plus three instance keys set once at `initialize` (admin,
  default token, id counter). There is no application backend holding state.
- **Two-state lifecycle:** `Pending → Paid`, transitioned atomically inside
  `fund_invoice` together with the client→freelancer token transfer (instant
  release — the contract never custodies funds). Double payment is impossible
  (`AlreadyPaid`), and a short client balance fails with a typed
  `InsufficientBalance` error instead of an opaque token trap.
- **Authorization is minimal and verified:** only the freelancer being credited
  can create their invoice, only the named client can fund it, and no admin
  power exists after one-time initialization. Authorization enforcement is
  covered by `MockAuth` tests (impostor and no-auth rejections).
- **Events for indexers:** `InvoiceCreated` and `InvoicePaid` emit
  freelancer/client as topics, so off-chain indexers can watch addresses
  directly instead of scanning invoices.

---

## What PayLoop contributes to the Stellar ecosystem

Ecosystem relevance beyond the product itself:

1. **A reusable, multi-token invoice/escrow contract.** A default payment token
   is chosen at `initialize`, extra tokens can be allowlisted and chosen per
   invoice, invoices store the token they were created with, and the
   instant-release escrow pattern is documented for reuse —
   [contracts/invoice/README.md](contracts/invoice/README.md) ships the
   lifecycle, storage model, auth matrix, error codes, event schema, build/test
   commands and copy-paste TypeScript/CLI integration examples against the live
   testnet deployment.
2. **A reusable authorization-test pattern.** `contracts/invoice/src/test.rs`
   pairs standard `mock_all_auths` convenience tests with `MockAuth`-verified
   tests that prove exactly which party must sign each write (including the
   nested token-transfer authorization inside `fund_invoice`) — a technique
   other Soroban teams can copy for their own `require_auth` coverage.
3. **Practical testnet-SAC lessons in the open.** The repo documents and
   implements the friction points of using an issued asset on Soroban testnet:
   in-app trustline management via `changeTrust` (Freighter's asset UI is
   unreliable across versions), a server-side faucet pattern with the issuer
   secret kept server-only, and the reason `ed25519-dalek` is pinned against a
   `soroban-env-host` testutils break (`contracts/invoice/Cargo.toml`).
4. **Contract CI that builds the real artifact.** Every push to `contracts/`
   runs fmt/clippy/tests and uploads the optimized `wasm32v1-none` WASM as a
   CI artifact — the deployable build is verifiable, not just claimed.

Known limitations are documented, not hidden: the testnet-only faucet (now
rate-limited per wallet, though best-effort on serverless), the id-scan
activity feed (correct long-term primitive would be the contract events), and
the unbounded growth of the per-freelancer history read — all in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the contract README.

---

## Deployment

| Item | Value |
| --- | --- |
| Network | Stellar Testnet |
| Invoice contract | [`CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS`](https://stellar.expert/explorer/testnet/contract/CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS) |
| Payment token (test USDC SAC) | [`CA3DMMHKAEV555MKWZB5AFXWB6LVZRETYNUO5ZCFGSENQOC7A2FL5HNU`](https://stellar.expert/explorer/testnet/contract/CA3DMMHKAEV555MKWZB5AFXWB6LVZRETYNUO5ZCFGSENQOC7A2FL5HNU) |
| Live app | https://pay-loop-neon.vercel.app |

Full deployment metadata: [`contracts/deployment.testnet.json`](contracts/deployment.testnet.json).

### Deploy the web app (Vercel)

The app is a standard Next.js project. From `web/`:

```bash
npm install
vercel --prod          # or import the repo in the Vercel dashboard
```

Set the root directory to `web/`. The public testnet contract/token addresses
are baked in as defaults, so the app works with **zero** env vars. To enable the
faucet, monitoring, or feedback forwarding, set `USDC_ISSUER_SECRET`,
`NEXT_PUBLIC_SENTRY_DSN` (+ `SENTRY_ORG`/`SENTRY_PROJECT`), and
`FEEDBACK_WEBHOOK_URL` in the Vercel project settings. See
[web/.env.example](web/.env.example).

### CI/CD

GitHub Actions runs on every push and pull request
([`.github/workflows/`](.github/workflows/)):

| Workflow | What it does |
| --- | --- |
| [`contract.yml`](.github/workflows/contract.yml) | **Contract CI** — `cargo fmt --check`, `clippy`, `cargo test`, and an optimized `wasm32v1-none` release build (uploaded as an artifact) |
| [`web.yml`](.github/workflows/web.yml) | **Web CI** — `npm ci`, `npm run lint`, `npm run build` |
| [`deploy.yml`](.github/workflows/deploy.yml) | **CD** — Vercel production deploy on push to `main` (via the Vercel CLI when `VERCEL_*` secrets are set; Vercel's native Git integration otherwise) |

---

## Repository layout

```
PayLoop/
├── .github/workflows/         CI (contract + web) and CD (Vercel) pipelines
├── contracts/
│   ├── invoice/               Soroban invoice/escrow contract (Rust) + tests
│   │   └── README.md          Integrator reference: lifecycle, auth, errors, events, examples
│   ├── DEPLOYMENT.md          Testnet deploy + token setup steps
│   └── deployment.testnet.json
├── scripts/
│   ├── build-excel.py         Generate docs/survey-responses.xlsx (stdlib only)
│   └── build-pitch.py         Generate the .pptx pitch deck (stdlib only)
├── web/                       Next.js frontend (App Router)
│   ├── app/                   routes incl. /history, /pitch, /activity, /api/*
│   ├── components/            wallet, theme, tour, invoice document, feedback
│   └── lib/                   config, wallet, contract, format
├── docs/
│   ├── ARCHITECTURE.md        System design
│   ├── ANCHOR.md              Mock vs. production off-ramp (SEP-24)
│   ├── FEEDBACK.md            User-feedback summary
│   ├── GROWTH.md              Feedback→shipped table + next-phase plan
│   ├── USERS.md               60-user proof log
│   ├── submission.md          Level 5 Blue Belt submission evidence & screenshots
│   ├── survey-responses.csv   Google Form CSV export
│   ├── survey-responses.xlsx  Generated Excel export (Responses + Summary)
│   ├── testnet-traction.csv   On-chain invoice activity snapshot
│   ├── pitch/                 PayLoop-Pitch-Deck.pptx
│   └── screenshots/           Submission screenshots
├── CONTRIBUTING.md            How to report bugs and submit PRs
├── AUDIT.md                   Maintainer-criteria audit + remediation trace
├── DEMO.md                    Demo-video + user-onboarding checklist
├── SUBMISSION.md              Level 5 requirement-by-requirement checklist
└── README.md
```

---

## Submission & evidence (Level 5 — Blue Belt)

Submission evidence, metrics, survey data, screenshots, and evaluation artifacts are organized under `docs/`:

- **Complete submission evidence & screenshots:** [docs/submission.md](docs/submission.md)
- **Requirement-by-requirement checklist:** [SUBMISSION.md](SUBMISSION.md)
- **Proof of 60 user wallet interactions:** [docs/USERS.md](docs/USERS.md) + live [Activity page](https://pay-loop-neon.vercel.app/activity)
- **User feedback iteration summary:** [docs/FEEDBACK.md](docs/FEEDBACK.md) + [docs/GROWTH.md](docs/GROWTH.md)
- **Excel export of survey responses:** [`docs/survey-responses.xlsx`](docs/survey-responses.xlsx)
- **Pitch deck:** [/pitch](https://pay-loop-neon.vercel.app/pitch) · [`docs/pitch/PayLoop-Pitch-Deck.pptx`](docs/pitch/PayLoop-Pitch-Deck.pptx)
- **Demo video:** [Loom walkthrough](https://www.loom.com/share/0b08c1208df841ac96ecd61b2b05a7a9) · script in [DEMO.md](DEMO.md)

---

## Roadmap

- **MVP (this):** single invoice, shareable pay link, instant release on fund, on-chain history.
- **Next:** live USDC↔Naira anchor off-ramp, milestone-based escrow (deposit + final), on-chain reputation score, recurring/retainer invoices, agency batch payouts.

---

## Contributing & license

- Bugs and feature requests: open an issue; see [CONTRIBUTING.md](CONTRIBUTING.md)
  for what to include and the review process. Security reports: private security
  advisory per [SECURITY.md](SECURITY.md).
- [MIT licensed](LICENSE).
