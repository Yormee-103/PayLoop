# Demo & onboarding guide

This is the runbook for demoing PayLoop end-to-end and for onboarding the 50+
users the Level 5 (Blue Belt) submission requires. It also lists exactly what
proof to capture.

## Live app

- **URL:** https://pay-loop-neon.vercel.app
- **Pitch deck:** https://pay-loop-neon.vercel.app/pitch (web) ·
  [`docs/pitch/PayLoop-Pitch-Deck.pptx`](docs/pitch/PayLoop-Pitch-Deck.pptx)
- **Network:** Stellar **Testnet** (set Freighter to Testnet)
- **Contract:** [`CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS`](https://stellar.expert/explorer/testnet/contract/CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS)

## Prerequisites (once per user)

1. Install [Freighter](https://freighter.app) browser extension.
2. Switch Freighter to **Testnet** (Settings → Network → Test Net).
3. Fund the account with test XLM from [friendbot](https://friendbot.stellar.org)
   (Freighter offers a "Fund with Friendbot" button on testnet).
4. **Enable USDC (one-time, required).** Open PayLoop → **Dashboard** →
   **Enable USDC** → approve. Every wallet must do this once before it can
   receive a payment (freelancer) or pay an invoice (client). Without it,
   payments fail with a "trustline missing" error on-chain. The app now detects
   this and tells you when a wallet still needs it.

## Level 5 demo video script (record with screen + narration)

Aim for **3–4 minutes**. Walk the full user journey and the new Level-5
features — the loop you show is the loop reviewers can verify on-chain.

1. **Landing → tour.** Open the app, show the landing page, and click the **?**
   button to replay the onboarding walkthrough (or let the auto-tour appear).
   This proves the onboarding improvement.
2. **Connect + fund.** Connect Freighter, go to **Dashboard**, **Enable USDC**,
   then **Get test USDC**.
3. **Create with preview.** **New invoice** → fill client address, amount,
   description → click **👀 Preview invoice** → show the clean invoice sheet →
   **Create invoice** → approve in Freighter. This proves the pre-send preview.
4. **Client pays.** Switch Freighter to the client account (enable USDC if new),
   open the `/pay/<id>` link, **Pay** → approve. Watch it flip to **Paid** with a
   `stellar.expert` link. **Download PDF receipt** to show PDF export.
5. **History.** Open **History**, search by description, filter by **Paid**, and
   show the **Remind** button that copies a payment reminder. This proves the
   history/search/filter and reminders features.
6. **Activity.** Open **Activity** → **Export CSV** → show the on-chain feed and
   usage stats (invoice count, paid count, unique wallets). This is the usage
   proof. Also screenshot the **theme toggle** (☀️/🌙) in the navbar.
7. **Withdraw.** Show the mocked USDC→Naira off-ramp UX.
8. **Feedback.** Leave feedback via the 💬 widget to close the loop.

Record this as the demo video (screen + narration). Show a real Freighter
signature at least once and the `stellar.expert` transaction page.

## Onboarding 50+ real users

Target: freelancers in writing/design/dev communities. For each user:

1. Send them this guide + the live URL.
2. Walk them through create → fund → paid (they can pair up as
   freelancer/client, or use two of their own testnet accounts).
3. Ask them to fill the **PayLoop user survey**
   ([https://forms.gle/FbtjeS6pYHW4FjwWA](https://forms.gle/FbtjeS6pYHW4FjwWA))
   — name, email, wallet address, network, product rating, and written feedback.

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
- `preview.png` — the pre-send invoice preview modal
- `history.png` — history page with search/filter
- `pay.png` — payment page (ideally the Paid state with tx link)
- `activity.png` — on-chain activity feed + stats (interaction proof)
- `mobile.png` — any page in a narrow viewport (mobile responsiveness)
- `analytics.png` — Vercel Analytics dashboard (50+ user usage)
- `monitoring.png` — Sentry issues/health (if enabled)
- `feedback.png` — the feedback widget open
- `theme-light.png` — light mode (optional)

See [docs/screenshots/README.md](docs/screenshots/README.md) for the full list.

## Feedback summary

Collate the survey responses and in-app widget submissions into
[docs/FEEDBACK.md](docs/FEEDBACK.md), then regenerate
[`docs/survey-responses.xlsx`](docs/survey-responses.xlsx) with
`python3 scripts/build-excel.py` after exporting the Google Form CSV.
