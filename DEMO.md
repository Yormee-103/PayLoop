# Demo & onboarding guide

This is the runbook for demoing PayLoop end-to-end and for onboarding the 10+
users the Level 4 submission requires. It also lists exactly what proof to
capture.

## Live app

- **URL:** _add the Vercel URL here after deploy_
- **Network:** Stellar **Testnet** (set Freighter to Testnet)
- **Contract:** [`CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS`](https://stellar.expert/explorer/testnet/contract/CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS)

## Prerequisites (once per user)

1. Install [Freighter](https://freighter.app) browser extension.
2. Switch Freighter to **Testnet** (Settings → Network → Test Net).
3. Fund the account with test XLM from [friendbot](https://friendbot.stellar.org)
   (Freighter offers a "Fund with Friendbot" button on testnet).

## The 90-second demo script

1. Open the app, click **Connect wallet** → approve in Freighter.
2. Go to **Dashboard** → **Get test USDC** (mints 500 test USDC to the wallet).
3. **New invoice**: paste a second wallet as the client, enter an amount + a
   description, submit → approve the transaction. Copy the `/pay/<id>` link.
4. Switch Freighter to the **client** account, open the pay link, click
   **Pay** → approve. Watch it flip to **Paid** with a `stellar.expert` link.
5. Open **Activity** to show the invoice in the public on-chain feed and the
   usage stats updating.
6. Open **Withdraw** to show the (mocked) USDC→Naira off-ramp UX.
7. Click the **💬 Feedback** button and leave a rating.

Record this as the demo video (screen + narration). Show a real Freighter
signature at least once and the `stellar.expert` transaction page.

## Onboarding 10+ real users

Target: freelancers in writing/design communities. For each user:

1. Send them this guide + the live URL.
2. Walk them through create → fund → paid (they can pair up as
   freelancer/client, or use two of their own testnet accounts).
3. Ask them to leave feedback via the in-app widget.

### Capturing proof of wallet interactions

Every interaction is already on-chain and publicly verifiable. Collect proof by:

- **Activity page** — screenshot `/activity`, which shows the invoice count,
  number of paid invoices, and **unique wallets involved**, each linking to the
  explorer.
- **Contract explorer** — the contract's transaction list on
  [stellar.expert](https://stellar.expert/explorer/testnet/contract/CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS)
  shows every `create_invoice` / `fund_invoice` call and the signing accounts.
- **Per-user** — record each participant's wallet address and a link to one of
  their transactions. Keep a simple table:

  | # | User (handle) | Role | Wallet address | Example tx |
  | - | ------------- | ---- | -------------- | ---------- |
  | 1 |               |      |                |            |

## Screenshots to capture (store in `docs/screenshots/`)

- `landing.png` — home page
- `dashboard.png` — dashboard with invoices + balance
- `create.png` — new-invoice form
- `pay.png` — payment page (ideally the Paid state with tx link)
- `activity.png` — on-chain activity feed + stats (interaction proof)
- `mobile.png` — any page in a narrow viewport (mobile responsiveness)
- `analytics.png` — Vercel Analytics dashboard
- `monitoring.png` — Sentry issues/health (if enabled)
- `feedback.png` — the feedback widget open

See [docs/screenshots/README.md](docs/screenshots/README.md) for the full list.

## Feedback summary

Collate the feedback widget submissions (and any DMs) into
[docs/FEEDBACK.md](docs/FEEDBACK.md).
