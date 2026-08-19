# Growth, feedback & next-phase plan (Level 5 — Blue Belt)

This document is the PayLoop Level-5 iteration summary: how the product changed
in response to real user feedback, how we're growing the user base, and exactly
what we're building next — with the git commits that shipped each improvement.

## Where the feedback came from

- **PayLoop user survey** (Google Form):
  [https://forms.gle/FbtjeS6pYHW4FjwWA](https://forms.gle/FbtjeS6pYHW4FjwWA) —
  collects name, email, wallet address, network, product rating, and written
  feedback.
- **Raw responses (Google Sheet, view-only):**
  [link](https://docs.google.com/spreadsheets/d/1Fijrwspc7AIIbs2a_ydaOWPQyCnI393nA9a5uPGIFwU/edit?usp=sharing)
- **Excel export (committed):** [`docs/survey-responses.xlsx`](survey-responses.xlsx)
  — regenerated from the form CSV with `python3 scripts/build-excel.py`.
- **In-app 💬 feedback widget** → `/api/feedback` (optional webhook sink).
- Full analysis: [docs/FEEDBACK.md](FEEDBACK.md).

## Feedback → shipped improvements (with commit links)

Each row links the shipped commit so reviewers can trace the iteration.

| # | User asked for | Shipped | Commit |
| - | -------------- | ------- | ------ |
| 1 | Invoice history / search & filtering (Robbert, Folarin) | New `/history` page with search + status/role filters + CSV-style PDF per invoice | https://github.com/Yormee-103/PayLoop/commit/f4ba23a |
| 2 | Invoice preview before sending (Robbert) | "👀 Preview invoice" on the create flow before the on-chain tx | https://github.com/Yormee-103/PayLoop/commit/56a7200 |
| 3 | PDF invoice export (Robbert, Kenny) | "Save as PDF" on preview, history, and paid receipts (print-optimized, no lib) | https://github.com/Yormee-103/PayLoop/commit/56a7200 |
| 4 | Onboarding tutorial / walkthrough & help (Aruleba, Kenny, Folarin) | First-run guided tour + navbar "?" replay + friendlier empty states | https://github.com/Yormee-103/PayLoop/commit/d6d55a1 |
| 5 | Payment reminders (Aruleba, Busayo) | One-click "Remind" that copies a ready-to-send reminder + reminders card on dashboard | https://github.com/Yormee-103/PayLoop/commit/e66990b |
| 6 | Dark mode (Robbert) | Dark/light theme toggle (dark default, persisted) | https://github.com/Yormee-103/PayLoop/commit/d6d55a1 |
| 7 | Loading speed / button prominence (Gbadebo, Bola) | Retry on all load errors, clearer loading text, stronger primary buttons | https://github.com/Yormee-103/PayLoop/commit/e66990b |
| 8 | Usage analytics / reporting (Bola) | Activity page **Export CSV** + live usage stats | https://github.com/Yormee-103/PayLoop/commit/44caad6 |
| 9 | Invoice templates & customization (7 survey responses) | Template picker on the create form (7 built-in service templates), "Save current as template" persisted in the browser, and delete for custom templates | https://github.com/Yormee-103/PayLoop/commit/9cd8b83 |
| 10 | Detailed help section (Aruleba, Kenny, Folarin) | New `/help` FAQ page — wallet setup, Enable USDC, test funds, creating/paying invoices, history/activity, withdrawing — linked from the navbar | https://github.com/Yormee-103/PayLoop/commit/d6ae41f |
| 11 | Reporting / usage analytics (Bola) | Activity page paid-vs-pending split bar + settled-volume-by-day/week chart, computed client-side from existing invoice data (no backend, no chart library) | https://github.com/Yormee-103/PayLoop/commit/a2cf1bb |

> Commit placeholders above are resolved to real short-hash links in the final
> docs pass after the feature commits land.

## How we're scaling user onboarding

- **Onboarding UX:** one-time "Enable USDC" with an inline explainer, testnet
  faucet in-app, guided first-run tour, and a copy-paste demo script
  ([DEMO.md](../DEMO.md)) for each user we onboard.
- **Onboarding loop:** share the app + survey → user connects wallet, enables
  USDC, creates and pays an invoice (real testnet transactions) → leaves a
  rating → we iterate on the theme of requests.
- **Proof:** every interaction is on-chain and visible on the public
  [Activity page](https://pay-loop-neon.vercel.app/activity) and on
  [stellar.expert](https://stellar.expert/explorer/testnet/contract/CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS).

## Next-phase plan (from this feedback cycle)

1. **Notifications** (Aruleba, Busayo) — real email/on-chain payment
   notifications, starting from the reminder flow shipped in this cycle.
2. **Multi-currency** (Tochi) — invoice in USDC/USDT/XLM with same-loop
   settlement via Stellar.
3. **Team & agency accounts** (Bola) — shared dashboards and batch payouts.
4. **Reporting tools** (Bola) — chart exports from the activity feed; invoice templates for faster invoicing shipped this cycle.
5. **Live anchor off-ramp** — replace the mocked USDC→Naira path with a licensed
   SEP-24 anchor integration ([ANCHOR.md](ANCHOR.md)).
6. **Milestone/held escrow** — deposit + release for larger projects, via the
   reserved `release_funds` ABI seam.
7. **On-chain reputation** — turn invoice history into a portable income/reputation
   score.

## How the roadmap is decided

Priorities come from the survey each cycle: high-frequency asks (history,
notifications, PDF) ship first; the always-on feedback widget keeps the signal
fresh between surveys.
