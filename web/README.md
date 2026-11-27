# PayLoop Web

Next.js (App Router) frontend for PayLoop — invoice foreign clients in USDC on
Stellar, cash out in Naira.

## Stack

- Next.js 15 + React 19 + TypeScript
- Tailwind CSS
- `@stellar/stellar-sdk` for on-chain calls
- `@stellar/freighter-api` + `@creit.tech/stellar-wallets-kit` for wallet adapters (Freighter, xBull, Albedo, Lobstr, Hana)
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

You'll need a supported Stellar wallet set to **Testnet**: Freighter, xBull,
Albedo, Lobstr or Hana. Choose it from the wallet picker when connecting.

## Environment variables

Testnet defaults for all public vars are baked into `.env.example`, so the app
runs without any configuration. Override in `.env.local` to point at a
different deployment.

### Public (browser-visible)

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_NETWORK` | `TESTNET` | Stellar network name passed to the SDK |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | testnet passphrase | Stellar network passphrase |
| `NEXT_PUBLIC_RPC_URL` | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint |
| `NEXT_PUBLIC_HORIZON_URL` | `https://horizon-testnet.stellar.org` | Horizon REST endpoint, used in the trustline flow |
| `NEXT_PUBLIC_CONTRACT_ID` | testnet contract | Invoice contract address |
| `NEXT_PUBLIC_TOKEN_ID` | testnet SAC | Test USDC Stellar Asset Contract address |
| `NEXT_PUBLIC_TOKEN_DECIMALS` | `7` | Decimal precision fallback; actual value is read from the token contract |
| `NEXT_PUBLIC_TOKEN_SYMBOL` | `USDC` | Token symbol fallback; actual value is read from the token contract |
| `NEXT_PUBLIC_TOKENS` | _(none)_ | Optional JSON array of extra allowlisted tokens: `[{"id":"C…","issuer":"G…","symbol":"USDY","decimals":6}]`. The default token is always included. |
| `NEXT_PUBLIC_SITE_URL` | auto | Canonical URL for Open Graph meta tags. Vercel sets `VERCEL_URL` automatically; only needed for custom domains. |
| `NEXT_PUBLIC_SENTRY_DSN` | _(none)_ | Optional Sentry DSN; build works without it |

### Server-only (never expose to the browser)

| Variable | Required | Purpose |
| --- | --- | --- |
| `USDC_ISSUER_SECRET` | faucet only | Issuer secret key (`S…`) for the test-USDC faucet (`/api/faucet`). Remove in production. |
| `FEEDBACK_WEBHOOK_URL` | no | Webhook (Slack/Discord/Zapier) that `/api/feedback` forwards submissions to. Logs server-side when unset. |
| `RATE_LIMITER_IP_LIMIT_PER_HOUR` | no | Max faucet mints per IP per hour (default: `5`) |
| `RATE_LIMITER_GLOBAL_DAILY_CAP` | no | Max total tokens minted per day in base units (default: `100000000000` = 10 000 USDC at 7 decimals) |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | no | Upstash Redis backend for global rate limiting across instances |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` | no | Vercel KV backend (alternative to Upstash) for global rate limiting |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | no | Sentry source-map upload at build time |

Without a Redis/KV backend, rate limiting is in-memory and best-effort (resets on each instance restart).

## Routes

- `/` — landing page
- `/create` — freelancer creates an invoice in the default or another allowlisted token (signs one tx)
- `/dashboard` — freelancer's invoices, balances, test-USDC faucet
- `/pay/[id]` — client-facing payment page; funds the invoice in one click
- `/statement` — printable income statement (paid invoices for a date range, with totals and verification links)
- `/withdraw` — mocked USDC→Naira off-ramp
- `/activity` — public on-chain feed of every invoice + usage stats
- `/api/faucet` — server route that mints test USDC (holds the issuer key)
- `/api/health` — uptime probe for Soroban RPC and the invoice contract
- `/api/feedback` — collects user feedback, forwards to an optional webhook

## The faucet

`/api/faucet` mints test USDC to a wallet by calling `mint` on the SAC as the
asset issuer. The issuer secret stays server-side. In production this route
would be removed — it exists only so demo users can get testnet balances.

Only `G...` account addresses are accepted; `C...` contract addresses are
rejected with 400. Before minting, the route asks Horizon whether the wallet
already trusts the configured test-USDC asset. A missing trustline returns 409
with guidance to use **Enable USDC** on the dashboard; a Horizon outage returns
502 rather than blaming the wallet. Send statuses are handled explicitly:
`PENDING` is polled, `DUPLICATE` is checked for confirmation, `TRY_AGAIN_LATER`
returns 503 with `Retry-After`, and all errors use fixed generic messages with
no RPC details, XDR or secrets.

## Health check

`GET /api/health` reports whether the latest Soroban ledger is available and
whether the invoice contract's `version()` read can be simulated. It returns:

```json
{
  "status": "healthy",
  "checks": {
    "ledger": { "ok": true, "sequence": 12345 },
    "contract": { "ok": true, "version": "v1" }
  }
}
```

A failed check returns `503` with `"status": "degraded"`; both checks are always
attempted. Responses use `Cache-Control: no-store`, contain no error text, and
never read any server-only secret.

```bash
curl -i http://localhost:3000/api/health
```

## The Naira off-ramp is mocked

`/withdraw` simulates a licensed anchor (SEP-24) end to end: it validates the
amount against your balance, shows the NGN conversion, and returns a reference.
**No real bank transfer happens and no on-chain funds move.** See
[`../docs/ANCHOR.md`](../docs/ANCHOR.md) for how this would connect to a real
anchor.

## Upgrading the Stellar SDK

`@stellar/stellar-sdk` is pinned to an exact version in `package.json` (no `^`
or `~`) and must stay that way. The SDK has to match the protocol version of
the network it talks to: a mismatch can make every transaction fail with
hard-to-diagnose errors such as "Bad union switch", with no change to our code.
A routine `npm install` must never move it.

To upgrade deliberately:

1. Check the network's current protocol version:

   ```bash
   curl -s https://horizon-testnet.stellar.org/ | grep protocol_version
   ```

   (`current_protocol_version` is what the network runs now.)

2. Read the SDK release notes for the target version and confirm it supports
   that protocol.
3. Change the version in `package.json` to the exact new version, then refresh
   the lockfile with `npm install --package-lock-only` and review the diff.
4. Run `npm ci`, `npm run lint` and `npm run build`.
5. Test by hand against testnet before merging: connect a supported wallet, create an
   invoice, fund it from a second wallet, and open History and Activity. These
   exercise simulate, sign and submit, and the read paths.

Mention the old and new SDK version and the protocol version you checked in the
pull request. Other PRs that touch `package.json` may conflict with an upgrade;
land the upgrade on its own.

## Deploy

Configured for Vercel. Set the env vars in the Vercel project settings, then:

```bash
vercel --prod
```

## Bundle analysis

Run `npm run analyze` to generate bundle reports in `.next/analyze/`. Baseline route sizes and findings are in [docs/bundle-size.md](../docs/bundle-size.md).
