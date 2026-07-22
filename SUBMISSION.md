# Level 4 — Green Belt submission checklist

Maps each requirement to where it's satisfied. ✅ = done & in repo, 🟡 = needs
you to complete a real-world step (onboard users, record video, capture images).

| Requirement | Status | Evidence |
| --- | --- | --- |
| Fully functional production MVP | ✅ | Live: https://pay-loop-neon.vercel.app — full create → pay → paid loop working on testnet |
| Stable frontend + contract architecture | ✅ | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); contract `contracts/invoice`, 7 unit tests |
| Mobile responsive UI | ✅ | Responsive grids + mobile nav drawer + stacked activity cards; `viewport` set in `web/app/layout.tsx` |
| Loading states + error handling | ✅ | `web/app/loading.tsx`, `error.tsx`, `global-error.tsx`, `not-found.tsx`; per-action spinners + Alerts |
| Min. 10 real users onboarded | 🟡 | Log in [docs/USERS.md](docs/USERS.md) — **onboard 10+ and fill the table** |
| Proof of wallet interactions | ✅ / 🟡 | Mechanism live ([/activity](https://pay-loop-neon.vercel.app/activity) + contract explorer); **needs 10+ real wallets logged** |
| Basic user feedback collection | ✅ | In-app widget + `/api/feedback`; summary in [docs/FEEDBACK.md](docs/FEEDBACK.md) (**fill with real responses**) |
| Production deployment | ✅ | Vercel, production alias above |
| Monitoring + analytics | ✅ | Sentry live & capturing events (see `docs/screenshots/analytics.png`) + Vercel Analytics wired |
| Optimized UX | ✅ | One-click pay, in-app trustline + faucet, explorer links, clear empty/error states |
| Project structure + documentation | ✅ | README + ARCHITECTURE / ANCHOR / FEEDBACK / USERS / DEMO |
| Smart contract on Stellar testnet | ✅ | `CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS` |
| Min. 15+ meaningful commits | ✅ | 30+ commits, conventional messages |
| Public GitHub repository | ✅ | https://github.com/Yormee-103/PayLoop |
| README with complete docs | ✅ | [README.md](README.md) |
| Live demo link | ✅ | https://pay-loop-neon.vercel.app |
| Contract deployment address | ✅ | See README deployment table |
| Screenshots (UI, mobile, analytics) | ✅ | 8 in [docs/screenshots/](docs/screenshots/): landing, dashboard, create, pay (paid), activity, feedback, mobile, Sentry monitoring |
| Demo video link | 🟡 | Record per [DEMO.md](DEMO.md) script; paste link here + in README |
| Proof of 10+ wallet interactions | 🟡 | [docs/USERS.md](docs/USERS.md) + Activity page screenshot |
| Basic user feedback summary | 🟡 | [docs/FEEDBACK.md](docs/FEEDBACK.md) with real entries |

## Remaining human tasks (cannot be done in code)

1. **Onboard 10+ real users** — share the live URL + [DEMO.md](DEMO.md)
   prerequisites; have each connect Freighter (testnet) and run create/pay.
   Record them in [docs/USERS.md](docs/USERS.md).
2. **Record the demo video** — follow the script in [DEMO.md](DEMO.md); show a
   real Freighter signature and the stellar.expert tx page. Paste the link here.
3. **Collect feedback** — get onboarded users to use the 💬 widget; summarise in
   [docs/FEEDBACK.md](docs/FEEDBACK.md).

_Screenshots (incl. mobile + Sentry monitoring) are done and in the repo._

## Demo video

_Paste the recorded demo video link here._
