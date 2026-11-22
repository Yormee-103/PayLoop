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

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_CONTRACT_ID` | public | Invoice contract address |
| `NEXT_PUBLIC_TOKEN_ID` | public | Test USDC Stellar Asset Contract |
| `NEXT_PUBLIC_TOKEN_DECIMALS` | public | Token decimals (7) |
| `NEXT_PUBLIC_RPC_URL` | public | Soroban RPC endpoint |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | public | Network passphrase |
| `USDC_ISSUER_SECRET` | **server only** | Issuer secret key for the test-USDC faucet. Never prefix with `NEXT_PUBLIC`. |
| `FEEDBACK_WEBHOOK_URL` | **server only** | Optional. Webhook (Slack/Discord/Zapier) that `/api/feedback` forwards submissions to. |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | mixed | Optional monitoring; build works without them |

Testnet defaults for the public vars are baked into `.env.example`.

## Routes

- `/` — landing page
- `/create` — freelancer creates an invoice (signs one tx)
- `/dashboard` — freelancer's invoices, balances, test-USDC faucet
- `/pay/[id]` — client-facing payment page; funds the invoice in one click
- `/withdraw` — mocked USDC→Naira off-ramp
- `/activity` — public on-chain feed of every invoice + usage stats
- `/api/faucet` — server route that mints test USDC (holds the issuer key)
- `/api/feedback` — collects user feedback, forwards to an optional webhook
- `/api/health` — uptime monitoring endpoint that verifies Soroban RPC and contract reachability

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

## Health & uptime monitoring

The `/api/health` route provides a lightweight health check designed for external
uptime monitors (e.g., Better Uptime, Datadog, Pingdom, UptimeRobot, or Kubernetes
probes).

### Endpoint specifications

- **Method**: `GET`
- **Path**: `/api/health`
- **Response Headers**: `Cache-Control: no-store, max-age=0`

### Checks performed

1. **Soroban RPC Check**: Queries the Soroban RPC endpoint for the latest ledger sequence (`rpc.getLatestLedger()`).
2. **Contract Simulation Check**: Simulates invoking the contract's `version()` entrypoint (`version() -> Symbol("v1")`).

### Response format

#### Healthy (HTTP 200)

Returned when both Soroban RPC and the contract are reachable and functional:

```json
{
  "status": "ok",
  "timestamp": "2026-11-22T02:58:00.000Z",
  "ledger": 5858503,
  "contract": {
    "status": "reachable",
    "version": "v1"
  }
}
```

#### Degraded (HTTP 503)

Returned when Soroban RPC is unreachable or contract simulation fails:

```json
{
  "status": "degraded",
  "timestamp": "2026-11-22T02:58:00.000Z",
  "error": "Contract simulation failed: HostError: Error(Value, InvalidInput)"
}
```

> **Security Note**: All error messages are sanitized before being returned.
> Server secrets (such as `USDC_ISSUER_SECRET`, `SENTRY_AUTH_TOKEN`, and `FEEDBACK_WEBHOOK_URL`),
> Stellar private keys (`S...`), and authorization tokens are strictly redacted
> and never leaked in the response.

### Uptime monitoring integration guidelines

When configuring an external uptime monitor:
- **Monitor type**: HTTP(S) check
- **Endpoint**: `https://<your-domain>/api/health`
- **Check interval**: 30 to 60 seconds
- **Expected HTTP status**: `200`
- **Keyword / Body Assertion** (optional): Match `"status":"ok"` or `"status": "ok"`

## Deploy

Configured for Vercel. Set the env vars in the Vercel project settings, then:

```bash
vercel --prod
```
