# PayLoop Web

Next.js (App Router) frontend for PayLoop — invoice foreign clients in USDC on
Stellar, cash out in Naira.

## Stack

- Next.js 15 + React 19 + TypeScript
- Tailwind CSS
- `@stellar/stellar-sdk` + `@stellar/freighter-api` for on-chain calls
- Vercel Analytics + Sentry for monitoring

## Local development

```bash
cp .env.example .env.local   # optional: testnet defaults are baked in
npm install
npm run dev                  # http://localhost:3000
```

The public contract/token addresses default to the live testnet deployment, so
the app runs against the real contract with no config. Override via `.env.local`
to point at a different deployment. The faucet button needs
`USDC_ISSUER_SECRET` set server-side.

You'll need the [Freighter](https://freighter.app) browser extension set to
**Testnet**.

## Environment variables

| Variable | Scope | Default | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_NETWORK` | public | `TESTNET` | Stellar network identifier (`TESTNET` or `PUBLIC`) |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | public | testnet passphrase | Network passphrase passed to the SDK |
| `NEXT_PUBLIC_RPC_URL` | public | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint |
| `NEXT_PUBLIC_HORIZON_URL` | public | `https://horizon-testnet.stellar.org` | Horizon REST endpoint; used for trustline ops and account data |
| `NEXT_PUBLIC_CONTRACT_ID` | public | live testnet contract | Invoice contract address |
| `NEXT_PUBLIC_TOKEN_ID` | public | live testnet SAC | Test USDC Stellar Asset Contract address |
| `NEXT_PUBLIC_TOKEN_ISSUER` | public | live testnet issuer | G-address of the USDC issuer; needed to build the `changeTrust` op in-app |
| `NEXT_PUBLIC_TOKEN_DECIMALS` | public | `7` | Token decimal places; actual value is read from the token contract at runtime |
| `NEXT_PUBLIC_TOKEN_SYMBOL` | public | `USDC` | Display symbol fallback; actual value is read from the token contract at runtime |
| `NEXT_PUBLIC_TOKENS` | public | _(none)_ | Optional JSON array of extra allowlisted tokens: `[{"id":"C…","issuer":"G…","symbol":"USDY","decimals":6}]`. The default token is always included. |
| `NEXT_PUBLIC_SITE_URL` | public | auto-detected | Canonical origin for Open Graph metadata. Falls back to `VERCEL_URL` in preview deploys, then `http://localhost:3000`. |
| `USDC_ISSUER_SECRET` | **server only** | _(none)_ | Secret key (`S…`) of the test-USDC issuer, used by `/api/faucet` to mint test USDC. Never prefix with `NEXT_PUBLIC`. |
| `RATE_LIMITER_IP_LIMIT_PER_HOUR` | **server only** | `5` | Max faucet mints per IP per hour |
| `RATE_LIMITER_GLOBAL_DAILY_CAP` | **server only** | `100000000000` | Max total tokens minted per day (base units; default = 10 000 USDC at 7 decimals) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | **server only** | _(none)_ | Optional Upstash Redis backend for global rate limiting across instances |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | **server only** | _(none)_ | Optional Vercel KV backend for global rate limiting (alternative to Upstash) |
| `FEEDBACK_WEBHOOK_URL` | **server only** | _(none)_ | Optional webhook (Slack/Discord/Zapier) that `/api/feedback` forwards submissions to |
| `NEXT_PUBLIC_SENTRY_DSN` | public | _(none)_ | Optional Sentry DSN for client and edge error reporting |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | **server only** | _(none)_ | Optional Sentry source-map upload credentials; build works without them |

Testnet defaults for the public vars are baked into `.env.example`.

## Routes

- `/` — landing page
- `/create` — freelancer creates an invoice in the default or another allowlisted token (signs one tx)
- `/dashboard` — freelancer's invoices, balances, test-USDC faucet
- `/pay/[id]` — client-facing payment page; funds the invoice in one click
- `/withdraw` — mocked USDC→Naira off-ramp
- `/activity` — public on-chain feed of every invoice + usage stats
- `/api/faucet` — server route that mints test USDC (holds the issuer key)
- `/api/feedback` — collects user feedback, forwards to an optional webhook

## The faucet

`/api/faucet` mints test USDC to a wallet by calling `mint` on the SAC as the
asset issuer. The issuer secret stays server-side. In production this route
would be removed — it exists only so demo users can get testnet balances.

## The Naira off-ramp is mocked

`/withdraw` simulates a licensed anchor (SEP-24) end to end: it validates the
amount against your balance, shows the NGN conversion, and returns a reference.
**No real bank transfer happens and no on-chain funds move.** See
[`../docs/ANCHOR.md`](../docs/ANCHOR.md) for how this would connect to a real
anchor.

## Deploy

Configured for Vercel. Set the env vars in the Vercel project settings, then:

```bash
vercel --prod
```
