# PayLoop architecture

PayLoop is a two-part system: a Soroban smart contract that is the source of
truth for invoices, and a Next.js web app that reads/writes it through the user's
Freighter wallet. There is no application database — all invoice state lives
on-chain, which is what makes the income history portable and tamper-proof.

Locked design decisions are recorded as
[Architecture Decision Records](adr/README.md) in `docs/adr/`.

```
┌─────────────────┐        sign tx        ┌──────────────────┐
│  Freelancer /   │ ───────────────────▶  │   Freighter      │
│  Client browser │ ◀───────────────────  │   wallet ext.    │
└────────┬────────┘     signed XDR         └──────────────────┘
         │
         │ read: simulate            write: prepare → submit → poll
         ▼
┌─────────────────────────┐        ┌───────────────────────────────┐
│  Next.js app (Vercel)   │        │  Soroban RPC (testnet)         │
│  - /create  /dashboard  │ ─────▶ │  soroban-testnet.stellar.org   │
│  - /pay/[id] /withdraw  │        └──────────────┬────────────────┘
│  - /activity            │                       │
│  - /api/faucet          │                       ▼
│  - /api/feedback        │        ┌───────────────────────────────┐
└─────────────────────────┘        │  Invoice contract (Wasm)       │
                                    │  CAQVSBNVL7OI…CSXS             │
                                    │  + test USDC SAC  CA3DMMHK…    │
                                    └───────────────────────────────┘
```

## The contract (`contracts/invoice`)

Rust / `soroban-sdk` 27. State is keyed by an enum `DataKey`:

- `Admin`, `DefaultToken`, `NextId` — instance storage set by the constructor at deployment.
- `Invoice(u64)` — each invoice struct, persistent storage.
- `History(Address)` — per-freelancer list of invoice ids, persistent.
- `ClientHistory(Address)` — per-client list of invoice ids, persistent
  (added in PR #42).

Entry points:

| Function                                                            | Auth       | Effect                                                                                                                                                                                  |
| ------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__constructor(admin, payment_token)`                               | deployer (deployment transaction) | runs once with deployment; sets default token, allowlist and id counter; admin can only grow the allowlist afterwards                                                                 |
| `add_allowed_token(admin, token)`                                   | admin      | adds a token to the allowlist (append-only)                                                                                                                                              |
| `create_invoice(freelancer, client, amount, description, due_date)` | freelancer | default-token variant; rejects non-positive amounts, self-directed invoices, empty descriptions; records a `Pending` invoice, appends to history, emits `InvoiceCreated`, returns id     |
| `create_invoice_with_token(..., token)`                             | freelancer | same, with an explicit allowlisted token stored on the invoice (`TokenNotAllowed` otherwise)                                                                                            |
| `fund_invoice(invoice_id)`                                          | client     | pre-checks the client balance (typed `InsufficientBalance` error instead of an opaque token trap), then atomic `token.transfer(client → freelancer)`, marks `Paid`, emits `InvoicePaid` |
| `release_funds(invoice_id)`                                         | —          | reserved seam for future held-escrow; no-op in the instant-release MVP                                                                                                                  |
| `get_invoice(id)` / `get_invoice_history(freelancer)`               | — (read)   | reads                                                                                                                                                                                   |
| `invoice_count()`                                                   | — (read)   | returns the number of invoices created so far                                                                                                                                           |
| `get_invoice_range(start, limit)`                                   | — (read)   | returns a bounded page of invoices by id                                                                                                                                                |
| `get_client_history(client)`                                        | — (read)   | reads the per-client list of invoice ids (`ClientHistory`)                                                                                                                              |
| `default_token_address()` / `get_allowed_tokens()` / `version()`    | — (read)   | metadata                                                                                                                                                                                |

Errors are a typed `contracterror` enum (`NotInitialized`,
`InvoiceNotFound`, `AlreadyPaid`, `InvalidAmount`, and — appended after the
v1 testnet deployment, keeping codes 1–5 wire-compatible —
`InvalidDescription`, `InvalidParties`, `InsufficientBalance`, `TokenNotAllowed`).
(`AlreadyInitialized` was removed with the `initialize` entrypoint.)

The unit tests in `contracts/invoice/src/test.rs` cover the
create→fund→paid loop, history ordering and empty-history, double-funding
rejection, non-positive amounts, missing invoices, timestamps,
constructor setup and the deployment-hijack scenario, sequential id allocation, self-directed invoices, empty
descriptions, exact vs. short client balances, and — without `mock_all_auths`
— the authorization matrix (freelancer auth required to create, client auth
required to fund, an impostor's auth rejected, no-auth rejections, and the
exact token-transfer sub-authorization inside `fund_invoice`).

Integrator-facing reference (entrypoints, arguments, auth, errors, events,
storage, reuse notes): [../contracts/invoice/README.md](../contracts/invoice/README.md).

### Escrow model

The MVP uses **instant release**: `fund_invoice` transfers straight from client
to freelancer in one atomic transaction, then flips status to `Paid`. There is
no window where the contract custodies funds. `release_funds` is intentionally
retained in the ABI so a future milestone model (deposit into the contract, then
release on a trigger) can slot in without an interface break.

## The web app (`web/`)

Next.js 15 App Router, React 19, TypeScript, Tailwind. Key modules:

- `lib/config.ts` — all network/contract config from `NEXT_PUBLIC_*`, with the
  live testnet deployment baked in as defaults so a clone runs immediately.
- `lib/wallet.ts` — wallet facade; SSR-guarded; selects an adapter (Freighter or Stellar Wallets Kit), persists the choice, and signs XDR.
- `lib/contract.ts` — builds transactions. **Reads** are `simulateTransaction`
  only (never submitted). **Writes** go `prepareTransaction` (simulate + assemble
  auth/footprint) → active wallet sign → `sendTransaction` → poll `getTransaction`.
- `lib/format.ts` — base-unit ↔ human conversion (7-decimal token math in `bigint`).
- `components/WalletProvider.tsx` — React context; re-hydrates a prior session
  from `localStorage`.
- `components/ThemeProvider.tsx` — dark/light theme (dark default), persisted to
  `localStorage`, toggles `.light` on `<html>`.
- `components/OnboardingTour.tsx` — first-run walkthrough, replayable via the
  navbar "?" (dispatches a `payloop:open-tour` event).
- `components/InvoiceDocument.tsx` — printable invoice sheet used by the
  pre-send preview and PDF export (`window.print()` with an isolated `.print-area`).

### Routes

| Route           | Type       | Purpose                                                                  |
| --------------- | ---------- | ------------------------------------------------------------------------ |
| `/`             | static     | landing                                                                  |
| `/create`       | static     | freelancer creates an invoice (preview → 1 signed tx)                    |
| `/dashboard`    | static     | freelancer's invoices, totals, faucet, reminders                         |
| `/pay/[id]`     | dynamic    | client funds an invoice (1 signed tx)                                    |
| `/history`      | static     | personal invoice history with search + status/role filters, PDF + remind |
| `/withdraw`     | static     | mocked USDC→Naira off-ramp                                               |
| `/activity`     | static     | public on-chain feed + usage stats + CSV export (proof of interactions)  |
| `/pitch`        | static     | live pitch deck (mirrors the .pptx)                                      |
| `/api/faucet`   | serverless | mints test USDC (holds issuer key, server-only)                          |
| `/api/feedback` | serverless | forwards user feedback to an optional webhook                            |

## Data flow: the core loop

1. Freelancer connects a supported wallet, calls `create_invoice` → gets invoice id →
   shares `/pay/<id>`.
2. Client opens the link, connects the wallet named on the invoice, funds it.
   `fund_invoice` moves USDC client→freelancer atomically and marks it `Paid`.
3. Both parties see the paid state on their dashboard / the public activity feed,
   with a `stellar.expert` link to the on-chain transaction.
4. Freelancer optionally off-ramps to Naira via `/withdraw` (mocked; see
   [ANCHOR.md](ANCHOR.md)).

## Observability

- **Sentry** — client/server/edge configs are no-ops unless
  `NEXT_PUBLIC_SENTRY_DSN` is set; `error.tsx` and `global-error.tsx` report
  render errors; `instrumentation.ts` wires request errors.
- **Vercel Analytics** — `<Analytics />` in the root layout for page/usage
  tracking, plus privacy-safe funnel events fired once per successful action
  via `trackEvent` in `web/lib/analytics.ts`. Events carry no wallet
  addresses, amounts, descriptions or other identifiers:
  `invoice_created`, `invoice_paid`, `faucet_requested`,
  `trustline_enabled`.

## Known limitations (documented, intentional for testnet)

- **Public activity feed reads by id-scan.** `/activity` (and the dashboard)
  walk invoice ids `1..250`, simulating one `get_invoice` per id on the public
  RPC. It works for the current invoice volume and does not depend on RPC event
  retention, but the correct long-term primitive is consuming the contract's
  `InvoiceCreated`/`InvoicePaid` events (topics index users for filtered
  queries). `max` (250) bounds the scan so a large ledger cannot hang the UI.
- **Faucet is a rate-limited test-token mint.** `/api/faucet` now serves
  only deployments whose network passphrase is the SDF testnet passphrase
  (returns 503 otherwise). Rate limiting can be configured:
  - **In-memory (default):** per-instance, best-effort. No env vars required.
  - **Global (Upstash Redis or Vercel KV):** set `UPSTASH_REDIS_REST_URL` +
    `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_URL` + `KV_REST_API_TOKEN`.
    Limits are then enforced across all serverless instances.

  Configurable limits:
  - Per-IP limit: `RATE_LIMITER_IP_LIMIT_PER_HOUR` (default: 5 mints/IP/hour).
  - Global daily cap: `RATE_LIMITER_GLOBAL_DAILY_CAP` (default: 100,000,000,000
    tokens = 10,000 USDC @ 7 decimals).

  Multiple wallets from one IP share the per-IP limit; one wallet can bypass
  per-IP limits by using different IPs. The rate limiter interface (`RateLimiter`
  in `web/lib/rate-limiter.ts`) can be extended with other backends (e.g.,
  DynamoDB, PostgreSQL) as needed. Untouched premise: the route mints a demo
  testnet asset and any deployment involving a real asset must still remove or
  replace it.

- **Read simulation source.** `web/lib/contract.ts` builds read simulations
  over a fixed, well-known funded testnet account (`READ_SOURCE`). It is only
  a simulation source: it never signs or funds anything, and reads are never
  submitted to the network.

## Security notes

- The faucet issuer secret (`USDC_ISSUER_SECRET`) lives only in server env and is
  used exclusively by `/api/faucet`. It is never exposed to the client (see the
  faucet limitation above).
- All contract writes require the acting party's `require_auth()`, enforced by
  the contract and now _verified by tests_ (the `MockAuth` tests in
  `contracts/invoice/src/test.rs` confirm create requires freelancer auth and
  fund requires client auth, with an impostor's auth rejected).
- The UI displays invoice descriptions exactly as recorded on-chain; it does
  not rewrite or soften the raw data (see `humanizeDescription` in
  `web/lib/format.ts`).
- No PII is stored; the only identifiers are public Stellar addresses.
