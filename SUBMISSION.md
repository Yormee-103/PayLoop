# Level 5 — Blue Belt submission checklist

Maps each requirement to where it's satisfied. ✅ = done & in repo · 🟡 =
in-progress / needs a real-world step (onboard users, record video, capture
dashboard screenshots).

## Submission checklist

| Requirement | Status | Evidence |
| --- | --- | --- |
| Public GitHub repository | ✅ | https://github.com/Yormee-103/PayLoop |
| Min. 20+ meaningful commits | ✅ | 45+ commits before Level 5; ~20+ new Level-5 commits with conventional messages |
| Live deployed application | ✅ | https://pay-loop-neon.vercel.app (Vercel CD on push to `main`) |
| **User growth** | | |
| Min. 50 testnet users onboarded | 🟡 | 10 in [docs/USERS.md](docs/USERS.md); **40+ more must be onboarded via the survey** before the deadline |
| Real transaction activity | 🟡 | 14 invoices on-chain in [docs/testnet-traction.csv](docs/testnet-traction.csv); grows with user onboarding |
| Active usage proof mandatory | ✅ | Live [/activity](https://pay-loop-neon.vercel.app/activity) (unique-wallet + invoice counts, CSV export) + [stellar.expert](https://stellar.expert/explorer/testnet/contract/CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS) |
| **Product improvements** | | |
| New features based on feedback | ✅ | History + search/filter, invoice preview, PDF export, reminders, onboarding tour, dark mode — see [docs/GROWTH.md](docs/GROWTH.md) with commit links |
| UX/UI + stability improvements | ✅ | Retry-on-error everywhere, loading polish, stronger buttons, better empty states |
| Optimized onboarding experience | ✅ | First-run tour, one-time USDC enablement, in-app faucet, walkthrough script |
| **Product presentation** | | |
| Professional pitch deck / PPT | ✅ | Live [/pitch](https://pay-loop-neon.vercel.app/pitch) + [`docs/pitch/PayLoop-Pitch-Deck.pptx`](docs/pitch/PayLoop-Pitch-Deck.pptx) (Problem, Solution, Market, Architecture, Growth, Roadmap) |
| **Demo** | | |
| Full product walkthrough/demo video | 🟡 | Script ready in [DEMO.md](DEMO.md); **record the Level-5 Loom video** and add the link to DEMO.md/README |
| **Technical standards** | | |
| Updated documentation | ✅ | README + GROWTH/FEEDBACK/USERS/ARCHITECTURE/ANCHOR/DEMO + Excel + pitch deck |
| **User onboarding requirements** | | |
| Google Form (wallet, email, name, rating, feedback) | ✅ | [PayLoop user survey](https://forms.gle/FbtjeS6pYHW4FjwWA) |
| Excel export of responses | ✅ | [`docs/survey-responses.xlsx`](docs/survey-responses.xlsx) (regenerate: `python3 scripts/build-excel.py`) |
| Excel linked in README | ✅ | README → "Feedback collection & Excel export" |
| README improvement plan + git commit links | ✅ | [docs/GROWTH.md](docs/GROWTH.md) (feedback → shipped → commit) linked from README |
| Proof of 50+ users | 🟡 | [docs/USERS.md](docs/USERS.md) — needs the 40+ onboarding round |
| Screenshots of analytics/transactions | 🟡 | [docs/screenshots/](docs/screenshots/) exist; capture updated Vercel Analytics + Activity screenshots after onboarding |
| User feedback iteration summary | ✅ | [docs/FEEDBACK.md](docs/FEEDBACK.md) + [docs/GROWTH.md](docs/GROWTH.md) |

## What's done in the repo (no action needed)

- Feedback-driven features (history, preview, PDF, reminders, tour, dark mode,
  retry/polish, CSV export).
- Excel export tooling + generated `docs/survey-responses.xlsx`.
- Pitch deck (.pptx + live `/pitch` page).
- Level-5 README, GROWTH, FEEDBACK, USERS, ARCHITECTURE, DEMO updates.
- CI/CD intact; web CI (lint + build) green locally.

## Remaining human tasks (cannot be done in code)

1. **Onboard 40+ more testnet users** — share the app + the
   [survey form](https://forms.gle/FbtjeS6pYHW4FjwWA); each user connects a
   Freighter wallet, runs create→pay on testnet, and leaves a rating. This is
   the biggest item.
2. **Export the form to Excel/CSV** when 50+ responses are in, replace
   `docs/survey-responses.csv`, and re-run `python3 scripts/build-excel.py`.
3. **Record the Level-5 demo video** (Loom) following [DEMO.md](DEMO.md) and add
   the link to the README + DEMO.md.
4. **Capture screenshots** — Vercel Analytics, Sentry, and the 50-user Activity
   page (these dashboards sit behind your own Vercel/Sentry login).
5. **Fill the 50-user table** in [docs/USERS.md](docs/USERS.md) from the survey
   responses (wallet addresses are in the form).
6. **Submit** the repo link before the monthly deadline.
