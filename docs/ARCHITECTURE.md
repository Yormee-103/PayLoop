# PayLoop architecture

PayLoop is a two-part system: a Soroban smart contract that is the source of
truth for invoices, and a Next.js web app that reads/writes it through the user's
Freighter wallet. There is no application database — all invoice state lives
on-chain, which is what makes the income history portable and tamper-proof.

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

- `Admin`, `DefaultToken`, `NextId` — instance storage set at `initialize`.
- `Invoice(u64)` — each invoice struct, persistent storage.
- `History(Address)` — per-freelancer list of invoice ids, persistent.

Entry points:

| Function | Auth | Effect |
| --- | --- | --- |
| `initialize(admin, payment_token)` | admin | one-time; sets default token + id counter |
| `create_invoice(freelancer, client, amount, description, due_date)` | freelancer | records a `Pending` invoice, appends to history, emits `InvoiceCreated`, returns id |
| `fund_invoice(invoice_id)` | client | atomic `token.transfer(client → freelancer)`, marks `Paid`, emits `InvoicePaid` |
| `release_funds(invoice_id)` | — | reserved seam for future held-escrow; no-op in the instant-release MVP |
| `get_invoice(id)` / `get_invoice_history(freelancer)` | — (read) | reads |
| `default_token_address()` / `version()` | — (read) | metadata |

Errors are a typed `contracterror` enum (`NotInitialized`, `AlreadyInitialized`,
`InvoiceNotFound`, `AlreadyPaid`, `InvalidAmount`). Seven unit tests in
`contracts/invoice/src/test.rs` cover the create→fund→paid loop, history
ordering, double-funding rejection, non-positive amounts, missing invoices,
timestamps, and double-initialize.

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
- `lib/wallet.ts` — thin Freighter wrapper; SSR-guarded; signs XDR.
- `lib/contract.ts` — builds transactions. **Reads** are `simulateTransaction`
  only (never submitted). **Writes** go `prepareTransaction` (simulate + assemble
  auth/footprint) → Freighter sign → `sendTransaction` → poll `getTransaction`.
- `lib/format.ts` — base-unit ↔ human conversion (7-decimal token math in `bigint`).
- `components/WalletProvider.tsx` — React context; re-hydrates a prior session
  from `localStorage`.

### Routes

| Route | Type | Purpose |
| --- | --- | --- |
| `/` | static | landing |
| `/create` | static | freelancer creates an invoice (1 signed tx) |
| `/dashboard` | static | freelancer's invoices, totals, faucet |
| `/pay/[id]` | dynamic | client funds an invoice (1 signed tx) |
| `/withdraw` | static | mocked USDC→Naira off-ramp |
| `/activity` | static | public on-chain feed + usage stats (proof of interactions) |
| `/api/faucet` | serverless | mints test USDC (holds issuer key, server-only) |
| `/api/feedback` | serverless | forwards user feedback to an optional webhook |

## Data flow: the core loop

1. Freelancer connects Freighter, calls `create_invoice` → gets invoice id →
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
  tracking.

## Security notes

- The faucet issuer secret (`USDC_ISSUER_SECRET`) lives only in server env and is
  used exclusively by `/api/faucet`. It is never exposed to the client and the
  route would be removed in a mainnet build.
- All contract writes require the acting party's `require_auth()`, enforced by
  the contract, so the client can only be charged for an invoice they sign.
- No PII is stored; the only identifiers are public Stellar addresses.
