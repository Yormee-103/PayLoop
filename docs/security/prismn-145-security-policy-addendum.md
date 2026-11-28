# Security policy addendum (prismn-145)

This standalone addendum supplies the missing response timeline, scope, and safe-harbour wording for `SECURITY.md` without changing the existing private-advisory reporting instructions.

## Acknowledgement and triage timeline

- **Acknowledgement:** within **2 business days** of receiving a private advisory.
- **Initial triage:** within **5 business days**, with an assessment of affected component, severity, and whether more information is needed.
- **Status updates:** at least every **7 days** while the report is being investigated or fixed.
- **Fix and disclosure:** fixes are prepared as regular PRs labelled `security`; public disclosure is coordinated with the reporter once a fix or mitigation is available.

These timelines apply to reports against the `main` branch and the current testnet deployment listed in the root README.

## In scope

- `contracts/invoice/` — Soroban invoice contract and its entrypoints, events, storage keys, and authorization checks.
- `web/app/` and `web/components/` — Next.js routes and components, including wallet connection, invoice creation/payment, history, and API routes.
- `web/lib/` — contract bindings, configuration, validation, and financial/amount formatting helpers.
- `SECURITY.md`, `docs/`, and deployment documentation where a factual error could lead to unsafe use.

## Out of scope

- Testnet faucet abuse against the demo asset; the faucet intentionally mints freely on testnet.
- The mocked SEP-24 off-ramp path (`docs/ANCHOR.md`); there are no real funds or anchor integrations to exploit.
- Third-party services and wallets (Freighter, Vercel, Sentry, Drips, GitHub) except where PayLoop code integrates with them.
- Reports that require a mainnet deployment; this project is testnet-only.

## Safe harbour

PayLoop supports good-faith security research. If you make a good-faith effort to avoid privacy violations, service disruption, and data destruction, and you report findings privately through the existing security advisory process, we will not pursue or support legal action against you for that research. We may ask for clarification, reproduction steps, or a transaction id; we will not ask you to test against production funds because none exist.

## Existing reporting instructions

Keep the current instruction to use GitHub's private security advisory rather than a public issue, and keep the required details: affected component, reproduction steps or transaction id, and impact assessment. Nothing in this addendum changes that reporting channel.

## Integration note

When applied to `SECURITY.md`, add the timeline after the acknowledgement sentence, add scope/safe-harbour sections before "Notes for reviewers of this contract", and preserve the existing testnet-only caveats unchanged.
