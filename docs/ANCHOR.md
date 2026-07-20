# Naira off-ramp: mock vs. production

PayLoop's `/withdraw` flow lets a freelancer convert USDC to Naira and send it
to a bank account. In this MVP that flow is **mocked**. This document explains
what the mock does and exactly what a production integration would replace.

## What the mock does today

- Reads the connected wallet's on-chain USDC balance.
- Validates the requested amount against that balance.
- Applies a fixed indicative rate (₦/USDC) and shows the payout amount.
- Collects a bank + account number.
- Simulates anchor settlement (a short delay) and returns a reference code.

No funds move on-chain and no bank transfer occurs. This keeps the end-to-end
payout story demonstrable without holding a money-transmitter license or live
anchor credentials.

## What production would look like (SEP-24)

Real fiat off-ramp on Stellar goes through a **licensed anchor** implementing
the SEP-24 (interactive withdrawal) standard:

1. **Discover the anchor** via its `stellar.toml` (`TRANSFER_SERVER_SEP0024`).
2. **Authenticate** with SEP-10 (challenge transaction signed by the user's
   wallet) to obtain a JWT.
3. **Initiate withdrawal**: `POST /transactions/withdraw/interactive` with the
   asset code and JWT. The anchor returns an interactive URL.
4. **KYC + bank details** are collected by the anchor in that interactive
   flow (not by PayLoop — this is what keeps PayLoop out of scope for money
   transmission).
5. **Send the USDC** to the anchor's distribution account in a Stellar payment,
   using the `memo` the anchor specified.
6. **Poll** `GET /transaction?id=...` until `status: completed`; the anchor
   disburses Naira to the user's bank.

### Candidate anchors for NGN

- Anchors in the Stellar ecosystem that support NGN corridors (e.g. via
  regional partners). The specific anchor is a business/compliance decision.

### Code seams already in place

- `/withdraw` is isolated; swapping the mock `setTimeout` settlement for the
  SEP-24 calls above touches only that page plus a new `lib/anchor.ts`.
- The wallet layer (`lib/wallet.ts`) already signs arbitrary XDR, which covers
  both the SEP-10 challenge and the withdrawal payment.

## Why mock for the MVP

Integrating a live anchor requires a signed agreement, KYC onboarding, and
production credentials — none of which are available for a testnet demo. The
mock demonstrates the full UX and the on-chain balance is real; only the
fiat leg is simulated.
