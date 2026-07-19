# PayLoop

**Get paid for freelance work in seconds, not weeks — with a permanent, portable income record.**

PayLoop is an invoicing + escrow dApp built on [Stellar](https://stellar.org)/Soroban. It lets freelancers (built with Nigerian & African freelancers working with foreign clients in mind) create an invoice, share a payment link, and receive **USDC** the moment a client funds it — settling in ~5 seconds for a fraction of a cent, instead of the 2–5 days and 5–8% that PayPal/Payoneer cost. Every paid invoice is a timestamped on-chain record that becomes the freelancer's portable income history.

---

## The core loop

```
create_invoice  →  fund_invoice (client pays, escrow + instant release)  →  Paid, on-chain forever
```

That create → fund → release loop is PayLoop. Everything else is UX around it.

## Why Stellar

| Problem (today) | PayPal / wire | PayLoop on Stellar |
| --- | --- | --- |
| **Speed** | 2–5 days; PayPal 21-day holds | ~5 second settlement |
| **Cost** | 3–5% fee + 5–8% FX markup | fractions of a cent network fee |
| **Income trail** | scattered bank alerts, WhatsApp | tamper-proof on-chain invoice history |
| **Compliance** | you become a money transmitter | anchors handle the regulated fiat on/off-ramp |

## Architecture

- **Smart contract** — `contracts/invoice`, Rust/Soroban, deployed to Stellar **testnet**. Holds invoices and performs the atomic client→freelancer USDC transfer on funding.
- **Web app** — `web/`, Next.js (App Router) + TypeScript + Tailwind, Freighter wallet, deployed on Vercel.
- **Observability** — Sentry (errors) + Vercel Analytics (usage).
- **Anchor off-ramp** — USDC → Naira bank payout is **mocked** for this submission with clear UX and a documented integration path. See [docs/ANCHOR.md](docs/ANCHOR.md).

Full design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Deployment

| Item | Value |
| --- | --- |
| Network | Stellar Testnet |
| Contract address | _filled in after deploy — see `contracts/DEPLOYMENT.md`_ |
| Payment token | Test USDC (Stellar Asset Contract) |
| Live app | _Vercel URL after deploy_ |

## Local development

Prerequisites: Node 20+, Rust + `stellar` CLI (`cargo install --locked stellar-cli`).

```bash
# Contract
cd contracts/invoice
cargo test                    # run unit tests
stellar contract build        # build the wasm

# Web
cd web
cp .env.example .env.local     # fill in contract + token addresses
npm install
npm run dev
```

See [contracts/DEPLOYMENT.md](contracts/DEPLOYMENT.md) for the full testnet deploy + token setup steps.

## Repository layout

```
PayLoop/
├── contracts/invoice/     Soroban invoice/escrow contract (Rust) + tests
├── web/                   Next.js frontend (dashboard + payment page)
├── docs/                  Architecture, anchor plan, screenshots
├── DEMO.md                Demo-video + user-onboarding checklist
└── README.md
```

## Roadmap

- **MVP (this):** single invoice, shareable pay link, instant release on fund, on-chain history.
- **Next:** live USDC↔Naira anchor off-ramp, milestone-based escrow (deposit + final), on-chain reputation score, recurring/retainer invoices, multi-stablecoin, agency batch payouts.

## License

MIT
