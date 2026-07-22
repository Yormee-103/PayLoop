# User feedback summary

Feedback was collected via the **PayLoop user survey** (Google Form) and the
in-app 💬 widget (posts to `/api/feedback`). **10 real users** tested the app on
Stellar testnet and submitted responses. This is the summary for the submission.

## Headline metrics

- **Responses:** 10
- **Average product rating:** **5.3 / 6** (ratings: 6, 6, 5, 5, 5, 5, 5, 6, 4, 6)
- **Would recommend:** **8 Yes, 2 Maybe, 0 No** (80% yes, 0% negative)
- **Bugs reported:** none blocking — only two minor performance notes (see below)

## Raw responses

| # | User | Network | Rating | Liked most | Recommend |
| - | ---- | ------- | ------ | ---------- | --------- |
| 1 | Robbert Abimbola | Testnet | 6/6 | "Creating invoices was simple and easy to understand." | Yes |
| 2 | Aruleba Pelumi | Testnet | 6/6 | "The wallet connection process was straightforward." | Yes |
| 3 | Daniel Johnson | Testnet | 5/6 | "The dashboard is clean and easy to navigate." | Yes |
| 4 | Busayo Akin | Testnet | 5/6 | "Connecting my Freighter wallet was very easy." | Yes |
| 5 | John | Testnet | 5/6 | "Moving between different sections of the app was easy." | Yes |
| 6 | Kenny Mary | Testnet | 5/6 | "The design looks modern and easy to understand." | Yes |
| 7 | Tochi | Testnet | 5/6 | "The invoice creation flow was very simple." | Yes |
| 8 | Folarin Oreofe | Testnet | 6/6 | "Testing the invoice flow was very straightforward." | Yes |
| 9 | Gbadebo Ahmad | Testnet | 4/6 | "The interface is clean and user friendly." | Maybe |
| 10 | Bola | Testnet | 6/6 | "The dashboard made everything easy to find." | Maybe |

## What worked

- **Simple invoice creation flow** — cited by the most users (Robbert, Tochi,
  Folarin): the create → send loop was understood without instruction.
- **Easy wallet connection** — Freighter connect was called out as
  straightforward (Aruleba, Busayo).
- **Clean, modern UI & navigation** — the dashboard and section navigation were
  repeatedly described as clean and easy to find things in (Daniel, John, Kenny,
  Bola).

## Bugs / usability issues reported

- Mostly none — 7 of 10 explicitly reported no bugs and a smooth experience.
- **Minor:** dashboard took a few extra seconds to load once (Aruleba); one user
  refreshed the page after connecting their wallet (Gbadebo). Both point at
  perceived load speed rather than functional bugs.
- **UX note:** "some buttons can stand out more" (Bola).

## Top requested improvements

1. **Invoice history / search & filtering** (Robbert, Folarin).
2. **Notifications & payment reminders** — email notifications for invoice
   updates and client payment reminders (Aruleba, Busayo).
3. **PDF invoice export & invoice preview before sending** (Robbert, Kenny).
4. **Onboarding tutorial / product walkthrough & help section** (Aruleba, Kenny,
   Folarin).
5. **Dark mode** (Robbert).
6. **Multi-currency support, team/business accounts, reporting tools** (Tochi,
   Bola).
7. **Loading speed / button prominence** (Gbadebo, Bola).

## How this feeds the roadmap

- **Notifications, invoice history/search, and PDF export** are the clearest
  high-frequency asks and are folded into the "Next" roadmap in the root README.
- **Onboarding walkthrough** is a cheap, high-impact win given how often it came
  up — a strong immediate next step.
- **Load-speed polish** (dashboard first paint) addresses the only recurring
  friction point.
- The anchor off-ramp path is documented in [ANCHOR.md](ANCHOR.md); moving it
  from mock to live remains the highest-value integration.
